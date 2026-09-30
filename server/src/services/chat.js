// Chat gateway: drives the real /seph-sdlc pipeline via the Claude engine and
// relays a live, multi-turn conversation to the browser. Two interchangeable
// backends behind one interface:
//   - "sdk": @anthropic-ai/claude-agent-sdk query() in streaming-input mode
//   - "cli": the `claude` binary with --input-format/--output-format stream-json
//
// A session keeps ONE engine conversation alive so the user can answer the
// pipeline's mandatory AskUserQuestion gates and issue the next `continue`
// without losing context. Both backends emit normalized events:
//   { kind: 'system'|'assistant'|'tool_use'|'tool_result'|'result'|'error'|'stdout', ... }

import { spawn } from 'node:child_process';
import { config } from '../config.js';

// Ensure the pipeline's expected env is present for whichever backend runs.
function pipelineEnv() {
  const env = { ...process.env };
  env.SEPHORA_WORKSPACE_ROOT = config.workspaceRoot;
  env.SEPHORA_PROJECT_DOCS = config.projectDocs;
  if (config.anthropicApiKey) env.ANTHROPIC_API_KEY = config.anthropicApiKey;
  return env;
}

const PERMISSION_MODE = process.env.CHAT_PERMISSION_MODE || 'bypassPermissions';

// Gate-answering via the chat: the pipeline normally stops at AskUserQuestion
// gates, which a headless session can't answer. We disable that tool and tell
// the agent to ask the human directly in chat and wait — the chat is multi-turn
// (streaming input), so the user's reply continues the same session.
const GATE_SYSTEM_PROMPT = [
  'You are running inside a web chat that drives the /seph-sdlc pipeline, with a human on the other side.',
  'When you need a decision, confirmation, or any input (a "gate"), ASK THE USER DIRECTLY in a normal chat',
  'message — state the question and list the options as a numbered list — then STOP and wait for their reply.',
  'Do NOT use the AskUserQuestion tool; it is unavailable here. After the user replies, continue exactly where',
  'you left off. Never abort or silently skip a stage because you cannot self-answer a gate — always ask the user.',
].join(' ');

const DISALLOWED_TOOLS = ['AskUserQuestion'];

/** A pushable async-generator used to stream user turns into a live SDK query. */
function createInputStream() {
  const queue = [];
  let resolveNext = null;
  let closed = false;

  function push(text) {
    if (closed) return;
    const msg = {
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: '',
    };
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r(msg);
    } else {
      queue.push(msg);
    }
  }

  function close() {
    closed = true;
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r(null);
    }
  }

  const gen = (async function* () {
    while (true) {
      if (queue.length) {
        yield queue.shift();
        continue;
      }
      if (closed) return;
      const next = await new Promise((res) => {
        resolveNext = res;
      });
      if (next == null) return;
      yield next;
    }
  })();

  return { gen, push, close };
}

// ---------------------------------------------------------------------------
// SDK backend
// ---------------------------------------------------------------------------
async function createSdkSession({ onEvent, onClose }) {
  let query;
  try {
    ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
  } catch (err) {
    throw Object.assign(new Error(
      'Agent SDK not installed. Run `npm i @anthropic-ai/claude-agent-sdk -w server`, ' +
      'or set CHAT_BACKEND=cli to use the claude binary.'), { cause: err });
  }

  const input = createInputStream();
  const abort = new AbortController();

  // Explicitly load the Sephora plugins — the SDK does NOT auto-load enabled
  // plugins like the interactive CLI does, so /seph-sdlc would otherwise be
  // unavailable. We load its dependency (sephora-mcp) too so it isn't skipped.
  const plugins = (config.sephoraPluginPaths || []).map((p) => ({ type: 'local', path: p }));

  const q = query({
    prompt: input.gen,
    options: {
      cwd: config.execCwd,
      // Load user + project settings so installed skills/agents are discoverable.
      settingSources: ['user', 'project'],
      ...(plugins.length ? { plugins } : {}),
      permissionMode: PERMISSION_MODE,
      disallowedTools: DISALLOWED_TOOLS,
      appendSystemPrompt: GATE_SYSTEM_PROMPT,
      includePartialMessages: false,
      env: pipelineEnv(),
      abortController: abort,
      stderr: (line) => onEvent({ kind: 'stderr', text: String(line) }),
    },
  });

  // Pump engine output to the client.
  (async () => {
    try {
      for await (const msg of q) {
        onEvent(mapSdkMessage(msg));
      }
    } catch (err) {
      if (!abort.signal.aborted) onEvent({ kind: 'error', text: err?.message || String(err) });
    } finally {
      onClose?.();
    }
  })();

  return {
    send: (text) => input.push(text),
    interrupt: async () => {
      try {
        if (typeof q.interrupt === 'function') await q.interrupt();
      } catch {
        /* ignore */
      }
    },
    close: () => {
      try {
        abort.abort();
      } catch {
        /* ignore */
      }
      input.close();
    },
  };
}

/** Map an SDK message object into our normalized event. */
function mapSdkMessage(msg) {
  const type = msg?.type;
  if (type === 'system') {
    return { kind: 'system', subtype: msg.subtype || null, sessionId: msg.session_id || null, raw: msg };
  }
  if (type === 'assistant' || type === 'user') {
    const content = msg?.message?.content;
    const blocks = Array.isArray(content) ? content : [];
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const toolUses = blocks.filter((b) => b.type === 'tool_use').map((b) => ({
      id: b.id,
      name: b.name,
      input: b.input,
    }));
    const toolResults = blocks.filter((b) => b.type === 'tool_result').map((b) => ({
      toolUseId: b.tool_use_id,
      content: b.content,
    }));
    if (toolUses.length) {
      return { kind: 'tool_use', role: type, text, tools: toolUses, raw: msg };
    }
    if (toolResults.length) {
      return { kind: 'tool_result', role: type, results: toolResults, raw: msg };
    }
    if (type === 'user') {
      // Engine-originated user messages are echoes of what we already showed, or
      // synthetic (e.g. slash-command / skill expansions) — flag so the UI can skip them.
      return { kind: 'user', text, fromEngine: true, raw: msg };
    }
    return { kind: 'assistant', text, raw: msg };
  }
  if (type === 'result') {
    return {
      kind: 'result',
      subtype: msg.subtype || null,
      isError: !!msg.is_error,
      costUsd: msg.total_cost_usd ?? null,
      numTurns: msg.num_turns ?? null,
      durationMs: msg.duration_ms ?? null,
      text: msg.result || null,
      raw: msg,
    };
  }
  if (type === 'stream_event') {
    return { kind: 'stream_event', raw: msg };
  }
  return { kind: 'unknown', raw: msg };
}

// ---------------------------------------------------------------------------
// CLI backend (fallback / alternative)
// ---------------------------------------------------------------------------
async function createCliSession({ onEvent, onClose }) {
  const args = [
    '--print',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--permission-mode', PERMISSION_MODE,
    '--disallowed-tools', DISALLOWED_TOOLS.join(','),
    '--append-system-prompt', GATE_SYSTEM_PROMPT,
  ];
  const child = spawn(config.claudeBin, args, {
    cwd: config.execCwd,
    env: pipelineEnv(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        onEvent(mapSdkMessage(JSON.parse(line)));
      } catch {
        onEvent({ kind: 'stdout', text: line });
      }
    }
  });
  child.stderr.on('data', (chunk) => onEvent({ kind: 'stderr', text: chunk.toString('utf8') }));
  child.on('error', (err) => onEvent({ kind: 'error', text: err.message }));
  child.on('close', (code) => {
    onEvent({ kind: 'system', subtype: 'exit', code });
    onClose?.();
  });

  function send(text) {
    const msg = {
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: '',
    };
    try {
      child.stdin.write(JSON.stringify(msg) + '\n');
    } catch {
      /* ignore */
    }
  }

  return {
    send,
    interrupt: async () => child.kill('SIGINT'),
    close: () => {
      try {
        child.stdin.end();
      } catch {
        /* ignore */
      }
      child.kill('SIGTERM');
    },
  };
}

/** Create a chat session using the configured backend. */
export async function createChatSession(handlers) {
  if (config.chatBackend === 'cli') return createCliSession(handlers);
  return createSdkSession(handlers);
}

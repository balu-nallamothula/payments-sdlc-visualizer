// Generate a commit message from the docs repo's uncommitted diff, using a
// one-shot, tool-free Claude call. Independent of the chat backend; loads no
// settings/plugins/MCP so it's fast.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const exec = promisify(execFile);
const DIR = config.projectDocs;
const MAX_DIFF = 16000;

const NO_TOOLS = [
  'Bash', 'Read', 'Edit', 'Write', 'NotebookEdit', 'Task', 'Agent',
  'Grep', 'Glob', 'WebFetch', 'WebSearch', 'TodoWrite',
];

export async function suggestCommitMessage() {
  const [statusRes, diffRes] = await Promise.all([
    exec('git', ['-C', DIR, 'status', '--porcelain'], { maxBuffer: 1e7 }).catch(() => ({ stdout: '' })),
    exec('git', ['-C', DIR, 'diff', 'HEAD'], { maxBuffer: 2e7 }).catch(() => ({ stdout: '' })),
  ]);
  const files = statusRes.stdout.trim();
  if (!files) {
    const e = new Error('No changes to describe');
    e.code = 'BAD_REQUEST';
    throw e;
  }
  let diff = diffRes.stdout;
  if (diff.length > MAX_DIFF) diff = `${diff.slice(0, MAX_DIFF)}\n…(diff truncated)…`;

  const prompt =
    'Write a single git commit message for the following changes in the sephora-project-docs repo. ' +
    'Use an imperative subject line no longer than 72 characters, and optionally a short body after a blank line. ' +
    'Return ONLY the commit message text — no code fences, no quotes, no preamble.\n\n' +
    `Changed files:\n${files}\n\nDiff:\n${diff || '(no textual diff; likely new/binary files)'}`;

  let query;
  try {
    ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
  } catch (err) {
    const e = new Error('Agent SDK not available to generate a message');
    e.code = 'UNAVAILABLE';
    throw e;
  }

  let text = '';
  const q = query({
    prompt,
    options: {
      cwd: DIR,
      settingSources: [], // no skills/plugins/MCP — pure text gen, fast
      permissionMode: 'bypassPermissions',
      disallowedTools: NO_TOOLS,
      env: { ...process.env },
    },
  });
  for await (const msg of q) {
    if (msg.type === 'assistant') {
      const blocks = Array.isArray(msg.message?.content) ? msg.message.content : [];
      text += blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
    } else if (msg.type === 'result' && !text && msg.result) {
      text = msg.result;
    }
  }

  text = text.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();
  if (!text) {
    const e = new Error('Could not generate a message');
    e.code = 'UNAVAILABLE';
    throw e;
  }
  return { message: text };
}

// Spike 0 — validate how the Claude Agent SDK drives /seph-sdlc and how its
// interactive AskUserQuestion gates surface, BEFORE wiring the full chat UI.
//
// Run:  npm run spike -- <initiative-name>
// e.g.  npm run spike -- inventory-service
//
// It (a) confirms the SDK is importable and streams output, (b) runs a read-only
// `/seph-sdlc status <initiative>`, and (c) fires a prompt designed to trigger an
// AskUserQuestion so you can SEE how the gate arrives (as a tool_use you can
// intercept, an error, etc.). Use the result to choose CHAT_BACKEND=sdk vs cli.

import { config, describeConfig } from '../src/config.js';

const initiative = process.argv[2] || 'inventory-service';

console.log('Spike config:', describeConfig());
console.log(`\nUsing initiative: ${initiative}\n`);

let query;
try {
  ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
  console.log('✓ @anthropic-ai/claude-agent-sdk imported');
} catch (err) {
  console.error('✗ Could not import @anthropic-ai/claude-agent-sdk.');
  console.error('  Install it: npm i @anthropic-ai/claude-agent-sdk -w server');
  console.error('  Or set CHAT_BACKEND=cli and validate the CLI stream-json path instead.');
  console.error('  Underlying error:', err?.message || err);
  process.exit(1);
}

const env = { ...process.env, SEPHORA_WORKSPACE_ROOT: config.workspaceRoot, SEPHORA_PROJECT_DOCS: config.projectDocs };

function summarize(msg) {
  const t = msg?.type;
  if (t === 'assistant' || t === 'user') {
    const blocks = Array.isArray(msg.message?.content) ? msg.message.content : [];
    for (const b of blocks) {
      if (b.type === 'text') console.log(`[${t}] ${b.text.slice(0, 500)}`);
      else if (b.type === 'tool_use') console.log(`[tool_use] ${b.name} -> ${JSON.stringify(b.input).slice(0, 300)}`);
      else if (b.type === 'tool_result') console.log(`[tool_result] ${JSON.stringify(b.content).slice(0, 200)}`);
    }
  } else if (t === 'result') {
    console.log(`[result] cost=$${msg.total_cost_usd} turns=${msg.num_turns} error=${msg.is_error}`);
  } else if (t === 'system') {
    console.log(`[system:${msg.subtype}] session=${msg.session_id}`);
  } else {
    console.log(`[${t}]`, JSON.stringify(msg).slice(0, 200));
  }
}

async function run(prompt, label) {
  console.log(`\n=== ${label} ===\nPrompt: ${prompt}\n`);
  try {
    const q = query({
      prompt,
      options: {
        cwd: config.execCwd,
        settingSources: ['user', 'project'],
        permissionMode: process.env.CHAT_PERMISSION_MODE || 'bypassPermissions',
        env,
      },
    });
    for await (const msg of q) summarize(msg);
  } catch (err) {
    console.error(`✗ ${label} failed:`, err?.message || err);
  }
}

// (b) read-only status — should always be safe.
await run(`/seph-sdlc status ${initiative}`, 'A. /seph-sdlc status (read-only)');

// (c) an AskUserQuestion trigger — watch HOW this arrives in the stream.
await run(
  'Use the AskUserQuestion tool to ask me to pick between "Option A" and "Option B". Then stop.',
  'B. AskUserQuestion gate behavior',
);

console.log('\nSpike complete. Note whether AskUserQuestion surfaced as a tool_use (interceptable) or errored.');

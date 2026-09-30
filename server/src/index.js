// Server entrypoint: Express REST/SSE API + a WebSocket chat gateway that drives
// the real /seph-sdlc pipeline.

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { config, describeConfig } from './config.js';
import { api } from './routes/api.js';
import { createChatSession } from './services/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Preflight: the whole app reads a live git repo at SEPHORA_PROJECT_DOCS. If that
// folder is missing, every poll of /api/git/status (and the scanner) fails, which
// used to spew git stack traces on a loop. Fail once here, loudly and clearly,
// instead — the message tells the tester exactly what to fix.
function preflight() {
  const c = describeConfig();
  if (c.projectDocsExists) return;
  const configuredVia = process.env.SEPHORA_PROJECT_DOCS ? '.env (SEPHORA_PROJECT_DOCS)' : 'the default fallback';
  console.error(
    [
      '',
      '  ✗ SDLC Visualizer cannot start.',
      '',
      '  SEPHORA_PROJECT_DOCS points to a folder that does not exist on this machine:',
      `      ${c.projectDocs}`,
      `  (resolved from ${configuredVia})`,
      '',
      '  Fix it: edit .env in the sdlc-visualizer folder and set the path to YOUR',
      '  local sephora-project-docs repo, for example:',
      '',
      '      SEPHORA_PROJECT_DOCS=~/sourcecode/Sephora/sephora-project-docs',
      '',
      '  (~ expands to your home folder, so you do not need to hardcode a username.)',
      "  If you don't have the repo yet, clone sephora-project-docs first, then",
      '  point this at wherever you cloned it. Restart when done.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

preflight();

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use('/api', api);

// Serve the built frontend in production, if present.
const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// Central error handler.
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[api error]', err);
  res.status(500).json({ error: err?.message || 'Internal error' });
});

const server = http.createServer(app);

// WebSocket chat gateway at /ws/chat.
const wss = new WebSocketServer({ server, path: '/ws/chat' });

wss.on('connection', async (ws) => {
  const sendJson = (obj) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };

  let session = null;
  try {
    session = await createChatSession({
      onEvent: (evt) => sendJson({ type: 'event', event: evt }),
      onClose: () => sendJson({ type: 'closed' }),
    });
    sendJson({ type: 'connected', backend: config.chatBackend });
  } catch (err) {
    sendJson({ type: 'event', event: { kind: 'error', text: err?.message || String(err) } });
    ws.close();
    return;
  }

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === 'send' && typeof msg.text === 'string') {
      session.send(msg.text);
    } else if (msg.type === 'interrupt') {
      await session.interrupt();
    }
  });

  ws.on('close', () => {
    session?.close();
  });
});

server.listen(config.port, () => {
  const c = describeConfig();
  // eslint-disable-next-line no-console
  console.log(`\n  SDLC Visualizer server`);
  console.log(`  → http://localhost:${config.port}`);
  console.log(`  project-docs: ${c.projectDocs} ${c.projectDocsExists ? '✓' : '✗ (not found)'}`);
  console.log(`  year dir:     ${c.yearDir} ${c.yearDirExists ? '✓' : '✗ (not found)'}`);
  console.log(`  coach cards:  ${c.coachStagesDir || '(unset)'} ${c.coachStagesDirExists ? '✓' : '✗'}`);
  console.log(`  chat backend: ${c.chatBackend}`);
  console.log(`  sdlc plugins: ${c.sephoraPluginsFound} found ${c.sephoraPluginsFound ? '✓' : '✗'}\n`);
});

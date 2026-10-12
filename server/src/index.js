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

// Validate pasted/uploaded images from the client before forwarding to the engine:
// allowlisted media types, base64 payload, capped size (~5MB raw) and count.
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 8;
function sanitizeImages(images) {
  if (!Array.isArray(images)) return undefined;
  const out = [];
  for (const img of images.slice(0, MAX_IMAGES)) {
    if (!img || !IMAGE_TYPES.has(img.media_type) || typeof img.data !== 'string' || !img.data) continue;
    // base64 → ~3/4 bytes; reject oversized payloads.
    if (img.data.length * 0.75 > MAX_IMAGE_BYTES) continue;
    out.push({ media_type: img.media_type, data: img.data });
  }
  return out.length ? out : undefined;
}

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

// Behind a reverse proxy (e.g. Nova) the app is mounted under a sub-path and the
// full prefixed path is forwarded. Strip it once, at the edge, so routes declared
// as "/api/..." still match. Empty-safe — a no-op when BASE_PATH is unset (local).
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '');

const app = express();
if (BASE_PATH) {
  app.use((req, res, next) => {
    if (req.url === BASE_PATH || req.url.startsWith(`${BASE_PATH}/`) || req.url.startsWith(`${BASE_PATH}?`)) {
      req.url = req.url.slice(BASE_PATH.length) || '/';
    }
    next();
  });
}
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use('/api', api);

// Serve the built frontend in production, if present. The built index.html ships
// with NO <base> tag; when mounted under a sub-path we inject an absolute
// <base href="${BASE_PATH}/"> here, at serve time, so the SPA's relative asset/
// API/WS URLs and the router basename all resolve inside the mount — at any route
// depth. Standalone (BASE_PATH empty) needs none: assets resolve against "/".
const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  const rawIndex = fs.readFileSync(path.join(webDist, 'index.html'), 'utf8');
  const indexHtml = BASE_PATH
    ? rawIndex.replace('<head>', `<head>\n    <base href="${BASE_PATH}/" />`)
    : rawIndex;
  // index:false so "/" falls through to the handler below (serving the
  // base-injected HTML) instead of express.static returning the raw file.
  app.use(express.static(webDist, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.type('html').send(indexHtml);
  });
}

// Central error handler.
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[api error]', err);
  res.status(500).json({ error: err?.message || 'Internal error' });
});

const server = http.createServer(app);

// WebSocket chat gateway at /ws/chat (prefixed with the mount path so the upgrade
// request matches behind a reverse proxy; just /ws/chat standalone).
const wss = new WebSocketServer({ server, path: `${BASE_PATH}/ws/chat` });

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
      session.send(msg.text, sanitizeImages(msg.images));
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

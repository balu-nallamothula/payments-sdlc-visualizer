// REST + SSE routes for the visualizer.

import { Router } from 'express';
import { describeConfig, loadDevplanConfig } from '../config.js';
import {
  listInitiatives,
  getInitiativeDetail,
  getJiraDetail,
} from '../services/scanner.js';
import { getStages, getStage, getReferenceDoc } from '../services/coaching.js';
import { readArtifact, writeArtifact, listArtifacts } from '../services/artifacts.js';
import { buildInitiativePipeline, CANONICAL_STAGES } from '../normalize.js';
import { docsWatcher } from '../services/watcher.js';
import { gitStatus, gitCommit } from '../services/git.js';
import { suggestCommitMessage } from '../services/commitMessage.js';
import { jiraMyself, jiraIssue, jiraEpicIssues, isValidIssueKey } from '../services/jira.js';

export const api = Router();

// ---- Dev Plan board: config + read-only live Jira proxy --------------------
// The board reads its config over HTTP (sprints/systems/colors/defaults) and
// pulls epics live from Jira through this proxy. Each Jira call forwards the
// user's own PAT (X-Jira-Token header, never stored) as a Bearer token.

// Strictly read-only: reject any non-GET method under /devplan with 405.
api.all('/devplan/*', (req, res, next) => {
  if (req.method === 'GET') return next();
  res.status(405).json({ error: 'This endpoint is read-only. Only GET is allowed.' });
});

api.get('/devplan/config', (req, res) => {
  // Re-read fresh so the client picks up on-disk edits on refresh (server-only
  // jira fields still need a restart). No secrets live in this file.
  res.set('Cache-Control', 'no-store');
  res.json(loadDevplanConfig());
});

api.get('/devplan/jira/myself', async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const token = req.header('x-jira-token');
  if (!token) {
    return res.status(401).json({
      error: 'Missing Jira token. Paste your Personal Access Token in the Connect panel.',
    });
  }
  try {
    res.json(await jiraMyself(token));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

api.get('/devplan/jira/issue', async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const token = req.header('x-jira-token');
  if (!token) return res.status(401).json({ error: 'Missing Jira token.' });
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'key is required' });
  if (!isValidIssueKey(String(key))) {
    return res.status(400).json({ error: 'key must be a Jira issue key like PAY-123' });
  }
  try {
    res.json(await jiraIssue(token, String(key)));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

api.get('/devplan/jira/epic-issues', async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const token = req.header('x-jira-token');
  if (!token) return res.status(401).json({ error: 'Missing Jira token.' });
  const epic = req.query.epic;
  if (!epic) return res.status(400).json({ error: 'epic is required' });
  if (!isValidIssueKey(String(epic))) {
    return res.status(400).json({ error: 'epic must be a Jira issue key like PAY-123' });
  }
  try {
    res.json({ epic: String(epic), issues: await jiraEpicIssues(token, String(epic)) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

api.get('/git/status', async (req, res, next) => {
  try {
    res.json(await gitStatus());
  } catch (err) {
    next(err);
  }
});

api.post('/git/suggest-message', async (req, res, next) => {
  try {
    res.json(await suggestCommitMessage());
  } catch (err) {
    const map = { BAD_REQUEST: 400, UNAVAILABLE: 503 };
    if (err.code && map[err.code]) return res.status(map[err.code]).json({ error: err.message });
    next(err);
  }
});

api.post('/git/commit', async (req, res, next) => {
  try {
    const { message, paths } = req.body || {};
    res.json(await gitCommit(message, paths));
  } catch (err) {
    if (err.code === 'BAD_REQUEST') return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: err.stderr || err.message });
  }
});

api.get('/health', (req, res) => {
  res.json({ ok: true, config: describeConfig() });
});

api.get('/canonical-stages', (req, res) => {
  res.json({ stages: CANONICAL_STAGES });
});

api.get('/initiatives', async (req, res, next) => {
  try {
    res.json({ initiatives: await listInitiatives() });
  } catch (err) {
    next(err);
  }
});

api.get('/initiatives/:name', async (req, res, next) => {
  try {
    const detail = await getInitiativeDetail(req.params.name);
    if (!detail) return res.status(404).json({ error: 'Initiative not found' });
    const pipeline = buildInitiativePipeline(detail.initiative, detail.jiras);
    const payload = {
      initiative: detail.initiative,
      pipeline,
      jiras: detail.jiras,
    };
    if (req.query.raw === '1') payload.raw = detail.meta;
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

api.get('/initiatives/:name/jiras/:jiraId', async (req, res, next) => {
  try {
    const detail = await getJiraDetail(req.params.name, req.params.jiraId);
    if (!detail) return res.status(404).json({ error: 'Jira not found' });
    const payload = { jira: detail.jira };
    if (req.query.raw === '1') payload.raw = detail.meta;
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

api.get('/stages', async (req, res, next) => {
  try {
    res.json({ stages: await getStages() });
  } catch (err) {
    next(err);
  }
});

api.get('/stages/:n', async (req, res, next) => {
  try {
    const stage = await getStage(req.params.n);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    res.json(stage);
  } catch (err) {
    next(err);
  }
});

api.get('/reference/:doc', async (req, res, next) => {
  try {
    const doc = await getReferenceDoc(req.params.doc);
    if (!doc) return res.status(404).json({ error: 'Reference doc not found' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

api.get('/artifacts', async (req, res, next) => {
  try {
    const { initiative, jira } = req.query;
    if (!initiative) return res.status(400).json({ error: 'initiative query param required' });
    res.json({ artifacts: await listArtifacts(String(initiative), jira ? String(jira) : null) });
  } catch (err) {
    next(err);
  }
});

api.get('/artifact', async (req, res, next) => {
  try {
    const rel = req.query.path;
    if (!rel) return res.status(400).json({ error: 'path query param required' });
    const artifact = await readArtifact(String(rel));
    res.json(artifact);
  } catch (err) {
    const map = { BAD_REQUEST: 400, FORBIDDEN: 403, NOT_FOUND: 404, TOO_LARGE: 413 };
    if (err.code && map[err.code]) return res.status(map[err.code]).json({ error: err.message });
    next(err);
  }
});

// Save (overwrite) an existing artifact.
api.put('/artifact', async (req, res, next) => {
  try {
    const { path: rel, content } = req.body || {};
    if (!rel) return res.status(400).json({ error: 'path is required' });
    const result = await writeArtifact(String(rel), content);
    res.json(result);
  } catch (err) {
    const map = { BAD_REQUEST: 400, FORBIDDEN: 403, NOT_FOUND: 404, TOO_LARGE: 413 };
    if (err.code && map[err.code]) return res.status(map[err.code]).json({ error: err.message });
    next(err);
  }
});

// Server-Sent Events for live refresh (opt-in from the client).
api.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);

  const unsubscribe = docsWatcher.subscribe((change) => {
    res.write(`event: change\ndata: ${JSON.stringify(change)}\n\n`);
  });

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
    res.end();
  });
});

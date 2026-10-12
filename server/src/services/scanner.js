// Filesystem scanner for sephora-project-docs.
// Finds initiative roots (flat OR pod-nested), reads + normalizes metadata,
// and lists Jiras. Read-only; results are cached by directory mtime.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config, yearDir } from '../config.js';
import { normalizeInitiative, normalizeJira, buildInitiativePipeline } from '../normalize.js';

// The stage the pipeline is actually working on — matches the detail view's
// CurrentStageHero: active, else blocked, else first not-done; else the last
// stage when everything is complete.
function deriveCurrentStage(cells) {
  const c =
    cells.find((x) => x.status === 'active') ||
    cells.find((x) => x.status === 'blocked') ||
    cells.find((x) => x.status !== 'done' && x.status !== 'skipped');
  if (c) return c.n;
  return cells.length ? Math.max(...cells.map((x) => x.n)) : null;
}

const cache = new Map(); // key -> { mtimeMs, value }

async function readJsonSafe(file) {
  try {
    const txt = await fsp.readFile(file, 'utf8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

async function statMtime(p) {
  try {
    return (await fsp.stat(p)).mtimeMs;
  } catch {
    return 0;
  }
}

async function isDir(p) {
  try {
    return (await fsp.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Find every initiative root: a directory that directly contains a metadata.json,
 * searching the year dir up to `maxDepth` levels deep (handles flat + pod-nested).
 * Does not descend into an initiative's own subfolders (jiras/, artifacts/, ...).
 */
export async function findInitiativeDirs(maxDepth = 2) {
  const roots = [];
  if (!fs.existsSync(yearDir)) return roots;

  async function walk(dir, depth, relParts) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const hasMeta = entries.some((e) => e.isFile() && e.name === 'metadata.json');
    if (hasMeta) {
      roots.push({ absPath: dir, id: relParts.join('/'), relPath: relParts.join('/') });
      return; // an initiative root; stop descending
    }
    if (depth >= maxDepth) return;
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.')) continue;
      await walk(path.join(dir, e.name), depth + 1, [...relParts, e.name]);
    }
  }

  await walk(yearDir, 0, []);
  return roots;
}

/** Count jira directories on disk for an initiative (cheap-ish; skips non-jira dirs). */
async function countJiraDirs(initiativeAbs) {
  const jirasDir = path.join(initiativeAbs, 'jiras');
  if (!(await isDir(jirasDir))) return 0;
  try {
    const entries = await fsp.readdir(jirasDir, { withFileTypes: true });
    let count = 0;
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      // Only count dirs that actually have a metadata.json (skip cross-team-comms etc.).
      if (fs.existsSync(path.join(jirasDir, e.name, 'metadata.json'))) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

/** List all initiatives as normalized summaries. */
export async function listInitiatives() {
  const dirs = await findInitiativeDirs();
  const out = [];
  for (const d of dirs) {
    const metaFile = path.join(d.absPath, 'metadata.json');
    const mtimeMs = await statMtime(metaFile);
    const cacheKey = `init:${d.absPath}`;
    const cached = cache.get(cacheKey);
    let meta;
    if (cached && cached.mtimeMs === mtimeMs) {
      meta = cached.value;
    } else {
      meta = await readJsonSafe(metaFile);
      cache.set(cacheKey, { mtimeMs, value: meta });
    }
    if (!meta) continue;
    // Read the jiras and build the SAME 12-cell pipeline the detail view uses, so
    // the card's percent / stage / strip match the detail (stages 5-12 aggregate
    // across the jiras, not the initiative's own current_stage pointer).
    const jiras = await listJiras(d.absPath);
    const summary = normalizeInitiative({ id: d.id, relPath: d.relPath, meta, jiraDirCount: jiras.length });
    const pipeline = buildInitiativePipeline(summary, jiras);
    summary.percent = pipeline.percent;
    summary.cells = pipeline.cells;
    summary.currentStageN = deriveCurrentStage(pipeline.cells) ?? summary.currentStageN;
    out.push(summary);
  }
  // Newest-ish first, then alphabetical.
  out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.id.localeCompare(b.id));
  return out;
}

/** Resolve an initiative's absolute path from its id (relPath under the year dir). */
export async function resolveInitiativeDir(id) {
  const dirs = await findInitiativeDirs();
  const match = dirs.find((d) => d.id === id || d.id.endsWith(`/${id}`) || path.basename(d.absPath) === id);
  return match || null;
}

/** List normalized Jiras for an initiative (reads each jira metadata.json). */
export async function listJiras(initiativeAbs) {
  const jirasDir = path.join(initiativeAbs, 'jiras');
  if (!(await isDir(jirasDir))) return [];
  let entries;
  try {
    entries = await fsp.readdir(jirasDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const metaFile = path.join(jirasDir, e.name, 'metadata.json');
    if (!fs.existsSync(metaFile)) continue; // skip non-jira dirs (cross-team-comms, etc.)
    const mtimeMs = await statMtime(metaFile);
    const cacheKey = `jira:${metaFile}`;
    const cached = cache.get(cacheKey);
    let meta;
    if (cached && cached.mtimeMs === mtimeMs) {
      meta = cached.value;
    } else {
      meta = await readJsonSafe(metaFile);
      cache.set(cacheKey, { mtimeMs, value: meta });
    }
    if (!meta) continue;
    out.push(normalizeJira({ id: e.name, relPath: path.join('jiras', e.name), meta }));
  }
  out.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  return out;
}

/** Full detail for one initiative: normalized initiative + its jiras. */
export async function getInitiativeDetail(id) {
  const dir = await resolveInitiativeDir(id);
  if (!dir) return null;
  const metaFile = path.join(dir.absPath, 'metadata.json');
  const meta = await readJsonSafe(metaFile);
  if (!meta) return null;
  const jiras = await listJiras(dir.absPath);
  const initiative = normalizeInitiative({
    id: dir.id,
    relPath: dir.relPath,
    meta,
    jiraDirCount: jiras.length,
  });
  return { dir, meta, initiative, jiras };
}

/** Get one normalized Jira with its raw metadata. */
export async function getJiraDetail(initiativeId, jiraId) {
  const dir = await resolveInitiativeDir(initiativeId);
  if (!dir) return null;
  const metaFile = path.join(dir.absPath, 'jiras', jiraId, 'metadata.json');
  const meta = await readJsonSafe(metaFile);
  if (!meta) return null;
  const jira = normalizeJira({ id: jiraId, relPath: path.join('jiras', jiraId), meta });
  return { dir, meta, jira };
}

// ---- Cross-AMP systems index (steward view) --------------------------------
// Invert the same initiative→jira walk into "which AMPs/jiras touch each repo".
// The repo (target_repositories[].name) is the join key. Reuses the mtime-cached
// readJsonSafe/listJiras, so repeated calls are cheap.

function impactBucket(level) {
  const s = String(level || '').trim().toUpperCase();
  if (s === 'CRITICAL' || s === 'HIGHEST') return 'critical';
  if (s === 'HIGH') return 'high';
  if (s === 'MEDIUM' || s === 'MED') return 'medium';
  if (s === 'LOW') return 'low';
  return 'unscored';
}

function toQuarter(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

// A stored quarter is "2026-Q3". Accept a query of "2026-Q3", "Q3", or "3".
function matchesQuarter(stored, query) {
  if (!stored) return false;
  const q = String(query || '').trim().toUpperCase();
  if (!q) return true;
  if (stored.toUpperCase() === q) return true;
  const m = stored.match(/Q(\d)$/i);
  return m ? m[1] === q.replace(/^Q/, '') : false;
}

async function buildSystemsIndex() {
  const dirs = await findInitiativeDirs();
  const byRepo = new Map();
  for (const d of dirs) {
    const meta = await readJsonSafe(path.join(d.absPath, 'metadata.json'));
    if (!meta) continue;
    const initiative = normalizeInitiative({ id: d.id, relPath: d.relPath, meta });
    const jiras = await listJiras(d.absPath);
    for (const j of jiras) {
      const repos = new Set((j.targetRepositories || []).map((r) => r.name).filter(Boolean));
      for (const repo of repos) {
        let agg = byRepo.get(repo);
        if (!agg) {
          agg = {
            repo,
            jiraCount: 0,
            initiatives: new Set(),
            impactCounts: { critical: 0, high: 0, medium: 0, low: 0, unscored: 0 },
            jiras: [],
          };
          byRepo.set(repo, agg);
        }
        agg.jiraCount += 1;
        agg.initiatives.add(initiative.id);
        agg.impactCounts[impactBucket(j.impactLevel)] += 1;
        agg.jiras.push({
          initiativeId: initiative.id,
          initiativeName: initiative.initiativeName,
          jiraId: j.id,
          title: j.title,
          impactLevel: j.impactLevel,
          currentStageN: j.currentStageN,
          status: j.status,
          component: j.component,
          platform: j.platform,
          prUrl: j.prUrl,
          quarter: toQuarter(j.createdTimestamp || initiative.createdAt),
        });
      }
    }
  }
  return [...byRepo.values()];
}

/** Summary of every repo touched across all AMPs (no per-jira detail). */
export async function listSystems() {
  const systems = await buildSystemsIndex();
  return systems
    .map((s) => ({ repo: s.repo, jiraCount: s.jiraCount, initiativeCount: s.initiatives.size, impactCounts: s.impactCounts }))
    .sort((a, b) => b.jiraCount - a.jiraCount || a.repo.localeCompare(b.repo));
}

/** One repo's detail: every AMP/jira impacting it, optionally filtered by quarter. */
export async function getSystemDetail(repo, quarter = null) {
  const systems = await buildSystemsIndex();
  const sys = systems.find((s) => s.repo === repo);
  if (!sys) return null;
  let jiras = quarter ? sys.jiras.filter((j) => matchesQuarter(j.quarter, quarter)) : sys.jiras;
  const impactCounts = { critical: 0, high: 0, medium: 0, low: 0, unscored: 0 };
  const inits = new Map();
  for (const j of jiras) {
    impactCounts[impactBucket(j.impactLevel)] += 1;
    if (!inits.has(j.initiativeId)) inits.set(j.initiativeId, j.initiativeName);
  }
  jiras = [...jiras].sort(
    (a, b) =>
      (a.initiativeId || '').localeCompare(b.initiativeId || '') ||
      String(a.jiraId).localeCompare(String(b.jiraId), undefined, { numeric: true }),
  );
  return {
    repo: sys.repo,
    jiraCount: jiras.length,
    initiativeCount: inits.size,
    initiatives: [...inits].map(([id, name]) => ({ id, name })),
    impactCounts,
    quarter: quarter || null,
    jiras,
  };
}

// Creating a new initiative is delegated to the pipeline's own `/seph-sdlc create`
// command (branch + dirs + full metadata + Stage 1), driven from the chat — the
// visualizer no longer writes a scaffold itself.

export function clearCache() {
  cache.clear();
}

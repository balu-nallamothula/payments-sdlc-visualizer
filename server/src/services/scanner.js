// Filesystem scanner for sephora-project-docs.
// Finds initiative roots (flat OR pod-nested), reads + normalizes metadata,
// and lists Jiras. Read-only; results are cached by directory mtime.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config, yearDir } from '../config.js';
import { normalizeInitiative, normalizeJira } from '../normalize.js';

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
    const jiraDirCount = await countJiraDirs(d.absPath);
    out.push(normalizeInitiative({ id: d.id, relPath: d.relPath, meta, jiraDirCount }));
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

export function clearCache() {
  cache.clear();
}

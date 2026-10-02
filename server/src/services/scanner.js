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

/** Folder-safe single segment from an initiative name ("Paze Discover" -> "paze-discover"). */
function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Create a new initiative scaffold on disk, in the shape the /seph-sdlc pipeline
 * expects to pick up at Stage 1:
 *   - ONE canonical kebab-case slug used for BOTH the folder and initiative_name
 *     (the pipeline requires initiative_name to be kebab-case AND to match the
 *     folder, which it resolves as <year>/<initiative_name>/ — so the folder is
 *     flat, never pod-nested).
 *   - every universal metadata key (phase "initiative", current_stage 1, empty
 *     stages/jiras/blocking/artifact_versions, review_overrides), plus the
 *     optional ones the form collects.
 * No branch is recorded: the pipeline creates initiative/<name> off main at
 * kickoff, so writing a branch that doesn't exist would be a false claim.
 * Returns { id, relPath, ... }.
 *
 * Coded errors: BAD_REQUEST (missing/unusable name), EXISTS (folder taken).
 */
export async function createInitiative(params = {}) {
  const rawName = String(params.initiativeName || '').trim();
  if (!rawName) {
    const e = new Error('Initiative name is required.');
    e.code = 'BAD_REQUEST';
    throw e;
  }

  // One slug for folder AND initiative_name (the pipeline keys off both matching).
  const slug = slugify(params.slug || rawName);
  if (!slug) {
    const e = new Error('Could not derive a valid kebab-case name from that input.');
    e.code = 'BAD_REQUEST';
    throw e;
  }

  const dir = path.join(yearDir, slug);
  if (fs.existsSync(dir)) {
    const e = new Error(`An initiative "${slug}" already exists.`);
    e.code = 'EXISTS';
    throw e;
  }

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const initiativeId = String(params.initiativeId || '').trim() || `${slug}-${ym}`;

  // Stage 1 (PRD creator) needs a brief to work from. If a free-text idea was
  // given (and no explicit brief path), seed inputs/one-pager.md with it so the
  // scaffold is runnable, not an empty shell.
  const idea = String(params.idea || '').trim();
  let onePager = String(params.onePagerPath || '').trim();
  if (!onePager && idea) onePager = 'inputs/one-pager.md';

  // Build in the key order the agent-written files use; include every universal
  // key (empty where the value isn't known yet) so the shape matches real files.
  const meta = { initiative_id: initiativeId, initiative_name: slug };
  meta.one_pager_path = onePager;
  meta.created_at = now.toISOString();
  meta.current_stage = 1;
  meta.phase = 'initiative';
  const epic = String(params.jiraEpic || '').trim();
  if (epic) meta.jira_epic = epic;
  const figma = String(params.figmaUrl || '').trim();
  if (figma) meta.figma_url = figma;
  if (params.greenfield) meta.greenfield = true;
  meta.review_overrides = {};
  meta.stages = {};
  meta.blocking_conditions = [];
  meta.jiras_created = [];
  meta.artifact_versions = {};

  await fsp.mkdir(dir, { recursive: true });
  // Seed the one-pager only when we generated the path from a free-text idea.
  if (idea && onePager === 'inputs/one-pager.md') {
    await fsp.mkdir(path.join(dir, 'inputs'), { recursive: true });
    await fsp.writeFile(path.join(dir, onePager), `# ${slug}\n\n${idea}\n`, 'utf8');
  }
  await fsp.writeFile(path.join(dir, 'metadata.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  clearCache();
  return { id: slug, relPath: slug, initiativeId, initiativeName: slug, onePagerPath: onePager };
}

export function clearCache() {
  cache.clear();
}

// Safe reader + lister for artifact files inside sephora-project-docs.
// Every path is resolved and asserted to stay within the docs root (no traversal),
// symlinks are resolved and re-checked, only text-ish files are served, size-capped.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { resolveInitiativeDir } from './scanner.js';

const ALLOWED_EXT = new Set(['.md', '.json', '.txt', '.yaml', '.yml', '.html']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_LIST = 500;

const DOCS_ROOT = path.resolve(config.projectDocs);
let REAL_ROOT = DOCS_ROOT;
try {
  REAL_ROOT = fs.realpathSync(DOCS_ROOT);
} catch {
  /* root may not exist in some envs; keep resolved path */
}

function withinRoot(absPath) {
  const p = path.resolve(absPath);
  return p === DOCS_ROOT || p.startsWith(DOCS_ROOT + path.sep);
}

function withinRealRoot(realPath) {
  return realPath === REAL_ROOT || realPath.startsWith(REAL_ROOT + path.sep);
}

/**
 * Read a single artifact by a path relative to the docs root.
 * Returns { relPath, ext, size, content } or throws an Error with .code.
 */
export async function readArtifact(relPath) {
  if (!relPath || typeof relPath !== 'string') {
    const e = new Error('Missing path');
    e.code = 'BAD_REQUEST';
    throw e;
  }
  // Reject absolute inputs and normalize.
  const clean = relPath.replace(/^\/+/, '');
  const target = path.resolve(DOCS_ROOT, clean);

  if (!withinRoot(target)) {
    const e = new Error('Path escapes docs root');
    e.code = 'FORBIDDEN';
    throw e;
  }
  const ext = path.extname(target).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    const e = new Error(`Extension not allowed: ${ext || '(none)'}`);
    e.code = 'FORBIDDEN';
    throw e;
  }

  let stat;
  try {
    stat = await fsp.stat(target);
  } catch {
    const e = new Error('Not found');
    e.code = 'NOT_FOUND';
    throw e;
  }
  if (!stat.isFile()) {
    const e = new Error('Not a file');
    e.code = 'NOT_FOUND';
    throw e;
  }
  // Resolve symlinks and re-check containment.
  const real = await fsp.realpath(target);
  if (!withinRealRoot(real)) {
    const e = new Error('Symlink escapes docs root');
    e.code = 'FORBIDDEN';
    throw e;
  }
  if (stat.size > MAX_BYTES) {
    const e = new Error('File too large');
    e.code = 'TOO_LARGE';
    throw e;
  }

  const content = await fsp.readFile(target, 'utf8');
  return { relPath: path.relative(DOCS_ROOT, target), ext, size: stat.size, content };
}

/**
 * Overwrite an existing artifact file. Same sandboxing as readArtifact; only
 * existing text-ish files inside the docs root can be written (no new-file
 * creation, no traversal, no symlink escape).
 */
export async function writeArtifact(relPath, content) {
  if (!relPath || typeof relPath !== 'string') {
    const e = new Error('Missing path');
    e.code = 'BAD_REQUEST';
    throw e;
  }
  if (typeof content !== 'string') {
    const e = new Error('content must be a string');
    e.code = 'BAD_REQUEST';
    throw e;
  }
  const target = path.resolve(DOCS_ROOT, relPath.replace(/^\/+/, ''));
  if (!withinRoot(target)) {
    const e = new Error('Path escapes docs root');
    e.code = 'FORBIDDEN';
    throw e;
  }
  const ext = path.extname(target).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    const e = new Error(`Extension not allowed: ${ext || '(none)'}`);
    e.code = 'FORBIDDEN';
    throw e;
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) {
    const e = new Error('File too large');
    e.code = 'TOO_LARGE';
    throw e;
  }
  let stat;
  try {
    stat = await fsp.stat(target);
  } catch {
    const e = new Error('Not found (only existing artifacts can be edited)');
    e.code = 'NOT_FOUND';
    throw e;
  }
  if (!stat.isFile()) {
    const e = new Error('Not a file');
    e.code = 'NOT_FOUND';
    throw e;
  }
  const real = await fsp.realpath(target);
  if (!withinRealRoot(real)) {
    const e = new Error('Symlink escapes docs root');
    e.code = 'FORBIDDEN';
    throw e;
  }
  await fsp.writeFile(target, content, 'utf8');
  return { relPath: path.relative(DOCS_ROOT, target), ext, size: Buffer.byteLength(content, 'utf8') };
}

/**
 * List artifact files under an initiative (and optionally a jira), recursively,
 * returning a flat list of { relPath, name, ext, dir } (relative to docs root).
 * Walks both the `artifacts/NN-*` and root-level `stage-N-*` conventions.
 */
export async function listArtifacts(initiativeId, jiraId = null) {
  const dir = await resolveInitiativeDir(initiativeId);
  if (!dir) return [];
  let base = dir.absPath;
  if (jiraId) base = path.join(dir.absPath, 'jiras', jiraId);
  if (!fs.existsSync(base)) return [];

  const results = [];
  const skipDirs = new Set(jiraId ? [] : ['jiras', 'node_modules', '.git', 'inputs', 'outputs']);

  async function walk(current, depth) {
    if (results.length >= MAX_LIST || depth > 5) return;
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (results.length >= MAX_LIST) break;
      if (e.name.startsWith('.')) continue;
      const abs = path.join(current, e.name);
      if (e.isDirectory()) {
        if (current === base && skipDirs.has(e.name)) continue;
        await walk(abs, depth + 1);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) continue;
        results.push({
          relPath: path.relative(DOCS_ROOT, abs),
          name: e.name,
          ext,
          dir: path.relative(base, path.dirname(abs)) || '.',
        });
      }
    }
  }

  await walk(base, 0);
  results.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return results;
}

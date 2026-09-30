// Minimal git helper for the sephora-project-docs repo: report uncommitted
// changes and optionally commit them. Uses execFile with an args array (no
// shell) so paths/messages can't inject commands. Scoped to config.projectDocs.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const exec = promisify(execFile);
const DIR = config.projectDocs;

/** Current branch + list of changed files (index/worktree). */
export async function gitStatus() {
  const [branchRes, statusRes] = await Promise.all([
    exec('git', ['-C', DIR, 'rev-parse', '--abbrev-ref', 'HEAD']).catch(() => ({ stdout: '' })),
    exec('git', ['-C', DIR, 'status', '--porcelain']),
  ]);
  const branch = branchRes.stdout.trim() || null;
  const files = statusRes.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2);
      let p = line.slice(3);
      if (p.includes(' -> ')) p = p.split(' -> ')[1]; // renames
      p = p.replace(/^"|"$/g, '');
      return { path: p, status: code.trim() || '??', staged: code[0] !== ' ' && code[0] !== '?' };
    });
  return { branch, files };
}

/** Stage the given paths (or all) and commit with a message. */
export async function gitCommit(message, paths) {
  if (!message || !message.trim()) {
    const e = new Error('Commit message required');
    e.code = 'BAD_REQUEST';
    throw e;
  }
  const list = Array.isArray(paths) && paths.length ? paths : null;
  if (list) await exec('git', ['-C', DIR, 'add', '--', ...list]);
  else await exec('git', ['-C', DIR, 'add', '-A']);
  const { stdout } = await exec('git', ['-C', DIR, 'commit', '-m', message]);
  return { ok: true, output: stdout.trim() };
}

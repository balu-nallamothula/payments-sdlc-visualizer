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

/** Local branches, remote-tracking branches, and the current branch. */
export async function gitBranches() {
  const [locRes, remRes, curRes] = await Promise.all([
    exec('git', ['-C', DIR, 'for-each-ref', '--format=%(refname:short)', 'refs/heads']),
    exec('git', ['-C', DIR, 'for-each-ref', '--format=%(refname:short)', 'refs/remotes']).catch(() => ({ stdout: '' })),
    exec('git', ['-C', DIR, 'rev-parse', '--abbrev-ref', 'HEAD']).catch(() => ({ stdout: '' })),
  ]);
  const branches = locRes.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
  const remotes = remRes.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((r) => !r.endsWith('/HEAD')); // skip the origin/HEAD alias
  return { current: curRes.stdout.trim() || null, branches, remotes };
}

/** Switch to an existing local branch. Without `force`, a checkout that would
 *  discard uncommitted changes fails (409) and the caller surfaces the reason.
 *  With `force` (git checkout -f), local changes to tracked files are discarded
 *  — irreversible; the caller must have confirmed. */
export async function gitCheckout(branch, { force = false } = {}) {
  if (!branch || typeof branch !== 'string') {
    const e = new Error('branch required');
    e.code = 'BAD_REQUEST';
    throw e;
  }
  // execFile is injection-safe, but restrict to a known local or remote branch so
  // a typo can't create an arbitrary branch or detach HEAD.
  const { branches, remotes } = await gitBranches();
  const isLocal = branches.includes(branch);
  const isRemote = !isLocal && remotes.includes(branch);
  if (!isLocal && !isRemote) {
    const e = new Error(`Unknown branch: ${branch}`);
    e.code = 'BAD_REQUEST';
    throw e;
  }

  let args;
  if (isLocal) {
    args = force ? ['-C', DIR, 'checkout', '-f', branch] : ['-C', DIR, 'checkout', branch];
  } else {
    // Remote ref (e.g. origin/feature/x) → check out (or create) a local branch
    // tracking it. Strip the remote name to get the local branch name.
    const localName = branch.slice(branch.indexOf('/') + 1);
    if (branches.includes(localName)) {
      args = force ? ['-C', DIR, 'checkout', '-f', localName] : ['-C', DIR, 'checkout', localName];
    } else if (force) {
      args = ['-C', DIR, 'checkout', '-f', '-b', localName, '--track', branch];
    } else {
      args = ['-C', DIR, 'checkout', '--track', branch];
    }
  }
  try {
    const { stdout } = await exec('git', args);
    return { ok: true, branch, forced: force, output: stdout.trim() };
  } catch (err) {
    const e = new Error(
      (err.stderr || err.message || '').trim() ||
        'Could not switch branch (commit or stash your changes first).',
    );
    e.code = 'CONFLICT';
    throw e;
  }
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

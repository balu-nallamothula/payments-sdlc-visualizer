// Central configuration, resolved from environment with sensible local defaults.
// Loaded once at startup; every service imports from here so paths stay consistent.

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import dotenv from 'dotenv';

// Load .env from the repo root (one level up from server/).
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const home = os.homedir();

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return home;
  if (p.startsWith('~/')) return path.join(home, p.slice(2));
  return p;
}

function resolveExisting(candidates) {
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  // Fall back to the first candidate even if missing, so error messages point somewhere sensible.
  return candidates.find(Boolean);
}

const projectDocs = expandHome(
  process.env.SEPHORA_PROJECT_DOCS ||
    resolveExisting([
      path.join(home, 'sourcecode', 'Sephora', 'sephora-project-docs'),
      path.join(home, 'workspace', 'sephora-project-docs'),
    ]),
);

const coachStagesDir = expandHome(
  process.env.COACH_STAGES_DIR ||
    resolveExisting([
      path.join(home, '.claude', 'skills', 'seph-sdlc-coach', 'stages'),
    ]),
);

const workspaceRoot = expandHome(process.env.SEPHORA_WORKSPACE_ROOT || path.join(home, 'workspace'));

// Locate the installed Sephora plugins so the chat/SDK session can load them
// (the SDK does NOT auto-load enabled plugins the way the interactive CLI does).
// We load ALL cached sephora-platform plugins so dependencies are satisfied —
// sephora-sdlc depends on sephora-mcp, and the SDK skips a plugin whose
// dependency isn't also loaded. sephora-mcp is ordered first.
function resolveSephoraPlugins() {
  const base = path.join(home, '.claude', 'plugins', 'cache', 'sephora-platform');
  const out = [];
  try {
    for (const name of fs.readdirSync(base)) {
      const pdir = path.join(base, name);
      let s;
      try {
        s = fs.statSync(pdir);
      } catch {
        continue;
      }
      if (!s.isDirectory()) continue;
      const versions = fs
        .readdirSync(pdir)
        .filter((v) => fs.existsSync(path.join(pdir, v, '.claude-plugin', 'plugin.json')))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (versions.length) out.push(path.join(pdir, versions[versions.length - 1]));
    }
  } catch {
    /* not installed */
  }
  // Load dependencies first (sephora-mcp before sephora-sdlc).
  out.sort((a, b) => (a.includes('sephora-mcp') ? -1 : b.includes('sephora-mcp') ? 1 : 0));
  if (process.env.SEPH_SDLC_PLUGIN_PATH) {
    const override = expandHome(process.env.SEPH_SDLC_PLUGIN_PATH);
    if (!out.includes(override)) out.push(override);
  }
  return out;
}

export const config = {
  projectDocs,
  coachStagesDir,
  workspaceRoot,
  year: process.env.SDLC_YEAR || '2026',
  execCwd: expandHome(process.env.EXEC_CWD || projectDocs),
  pluginRoot: expandHome(process.env.CLAUDE_PLUGIN_ROOT || ''),
  sephoraPluginPaths: resolveSephoraPlugins(),
  chatBackend: (process.env.CHAT_BACKEND || 'cli').toLowerCase(),
  claudeBin: process.env.CLAUDE_BIN || 'claude',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  port: Number(process.env.PORT) || 4317,
};

// The absolute directory we scan for initiatives, e.g. <projectDocs>/2026
export const yearDir = path.join(config.projectDocs, config.year);

export function describeConfig() {
  return {
    projectDocs: config.projectDocs,
    projectDocsExists: fs.existsSync(config.projectDocs),
    yearDir,
    yearDirExists: fs.existsSync(yearDir),
    coachStagesDir: config.coachStagesDir,
    coachStagesDirExists: config.coachStagesDir ? fs.existsSync(config.coachStagesDir) : false,
    workspaceRoot: config.workspaceRoot,
    execCwd: config.execCwd,
    chatBackend: config.chatBackend,
    sephoraPluginPaths: config.sephoraPluginPaths,
    sephoraPluginsFound: config.sephoraPluginPaths.length,
    year: config.year,
    port: config.port,
  };
}

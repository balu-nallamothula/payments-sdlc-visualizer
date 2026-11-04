#!/usr/bin/env bash
#
# pack-drop.sh — build a clean Nova Drop bundle for the AMP Visualizer.
#
# Nova runs your entrypoint; it does NOT build and does NOT run `npm install`.
# So the bundle must ship: the built SPA (web/dist), the server source, a single
# entrypoint, and a vendored node_modules with the production deps — and nothing
# else (no .git, no __MACOSX, no .DS_Store, no dev tooling).
#
# Output:
#   dist-drop/                 the staged bundle (gitignored)
#   sdlc-visualizer-drop.zip   the archive to upload to Nova (gitignored)
#
# Usage:  bash pack-drop.sh          (or: npm run pack:drop)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

STAGE="$ROOT/dist-drop"
ZIP="$ROOT/sdlc-visualizer-drop.zip"

# The deployment target. node_modules is vendored, so install for the runtime's
# platform (not this Mac), otherwise a native optional dep could be the wrong ABI.
TARGET_OS="${DROP_TARGET_OS:-linux}"
TARGET_CPU="${DROP_TARGET_CPU:-x64}"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }

step "Clean staging"
rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE"

step "Build the web (vite → web/dist, relative asset URLs)"
npm run build

step "Copy server source (no node_modules, no dev scripts)"
mkdir -p "$STAGE/server"
cp -R "$ROOT/server/src" "$STAGE/server/src"
cp "$ROOT/server/package.json" "$STAGE/server/package.json"
cp "$ROOT/server/devplan.config.json" "$STAGE/server/devplan.config.json"

step "Copy built SPA (web/dist)"
mkdir -p "$STAGE/web"
cp -R "$ROOT/web/dist" "$STAGE/web/dist"

step "Write entrypoint (server.js) + bundle package.json"
# Nova's manifest names "server.js" at the archive root; this shim just boots the
# real server. index.js resolves web/dist via import.meta.url, so it finds
# ../../web/dist = <bundle>/web/dist regardless of the cwd Nova uses.
cat > "$STAGE/server.js" <<'EOF'
// Nova Drop entrypoint. Nova runs this file; it only boots the real server.
// The server (server/src/index.js) serves both the built SPA and the REST/SSE/WS
// API from one process, and strips BASE_PATH so it works under Nova's sub-path.
import './server/src/index.js';
EOF

# A self-contained manifest for the bundle: only the production runtime deps the
# server actually imports. The agent SDK (chat "sdk" backend) is intentionally
# NOT vendored — the default "cli" backend uses Nova's own `claude` binary; add
# @anthropic-ai/claude-agent-sdk here only if you switch CHAT_BACKEND=sdk.
cat > "$STAGE/package.json" <<'EOF'
{
  "name": "sdlc-visualizer-drop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "chokidar": "^3.6.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "ws": "^8.18.0"
  }
}
EOF

step "Install production deps into the bundle (target: ${TARGET_OS}/${TARGET_CPU})"
# --omit=dev: runtime only. --os/--cpu: resolve optional native deps for the
# runtime platform, not this Mac (e.g. skip darwin-only fsevents cleanly).
( cd "$STAGE" && npm install --omit=dev --os="$TARGET_OS" --cpu="$TARGET_CPU" --no-audit --no-fund )
# Drop the lockfile npm just wrote — not needed to run, and it references this host.
rm -f "$STAGE/package-lock.json"

step "Write README-DROP.md (what Nova needs to know)"
cat > "$STAGE/README-DROP.md" <<'EOF'
# AMP Visualizer — Nova Drop bundle

One Node process serves both the built SPA and the REST/SSE/WebSocket API.

## Entrypoint
    server.js    (at the archive root)

## Required environment
- `SEPHORA_PROJECT_DOCS` — **absolute path to the sephora-project-docs repo in the
  runtime.** The whole app reads this git repo from disk; if it is missing the
  server exits on startup (by design). Nova must clone/mount it and point this here.

## Set by Nova (handled automatically)
- `BASE_PATH` — the Drop sub-path (e.g. /drops/sdlc-visualizer). The server strips
  it at the edge and the SPA reads it from <base href>. Empty = standalone.
- `PORT` — the port to listen on (defaults to 4317 if unset).

## Optional
- `CHAT_BACKEND` — `cli` (default; drives the `claude` binary on PATH) or `sdk`.
  For `sdk`, also vendor `@anthropic-ai/claude-agent-sdk` and set credentials.
- `CHAT_MODEL`, `ANTHROPIC_API_KEY`, `SEPHORA_WORKSPACE_ROOT`, `SDLC_YEAR`, `JIRA_BASE`.

## Notes
- Visualize (initiatives / jiras / stages / artifacts / Dev Plan) needs only
  SEPHORA_PROJECT_DOCS. The chat (running /seph-sdlc) additionally needs Claude
  available in the runtime.
- The Jira PAT lives only in the browser (localStorage); it is never bundled.
EOF

step "Zip (clean: no .git, no __MACOSX, no .DS_Store)"
# Use the zip CLI (not Finder) so no __MACOSX/ is added; -X drops extra attrs.
( cd "$STAGE" && zip -r -X -q "$ZIP" . -x '*.DS_Store' )

SIZE="$(du -sh "$ZIP" | cut -f1)"
printf '\n\033[1;32m✓ Bundle ready\033[0m\n'
printf '  archive:    %s (%s)\n' "$ZIP" "$SIZE"
printf '  entrypoint: server.js\n'
printf '  staged at:  %s\n' "$STAGE"
printf '\n  Upload sdlc-visualizer-drop.zip to Nova. Remember to set\n'
printf '  SEPHORA_PROJECT_DOCS in the Drop environment.\n\n'

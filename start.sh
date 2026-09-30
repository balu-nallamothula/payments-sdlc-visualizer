#!/usr/bin/env bash
#
# SDLC Visualizer — one-shot installer + launcher.
#
# What it does:
#   1. Checks that Node.js (>= 18) is installed.
#   2. Creates a .env from .env.example on first run.
#   3. Installs all dependencies (server + web workspaces).
#   4. Starts the API and the web UI, then opens the browser.
#
# Usage:
#   ./start.sh              (from a terminal)
#   double-click start.command  (from Finder on macOS)
#
set -euo pipefail

# --- Always run from the folder this script lives in -------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WEB_URL="http://localhost:5317"

say()  { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }
ok()   { printf "\033[1;32m  ✓ %s\033[0m\n" "$1"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$1"; }
die()  { printf "\n\033[1;31m✗ %s\033[0m\n" "$1"; exit 1; }

# --- 1. Node.js check (with optional auto-install) ---------------------------
say "Checking prerequisites"

# Make Homebrew's node visible if brew is installed but not yet on PATH.
if ! command -v brew >/dev/null 2>&1; then
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$b" ] && eval "$("$b" shellenv)" && break
  done
fi

install_node() {
  # Only auto-install on macOS; other platforms get a manual message.
  if [ "$(uname -s)" != "Darwin" ]; then
    die "Node.js is not installed. Install the LTS version from https://nodejs.org and re-run this script."
  fi

  warn "Node.js was not found on this Mac."
  printf "  Install it now automatically? [Y/n] "
  read -r reply
  case "${reply:-Y}" in
    [Nn]*) die "Install Node.js (LTS) from https://nodejs.org and re-run this script." ;;
  esac

  # Ensure Homebrew is available (install it if needed).
  if ! command -v brew >/dev/null 2>&1; then
    warn "Homebrew (the installer Node uses) is also missing."
    printf "  Install Homebrew now? You may be asked for your Mac password. [Y/n] "
    read -r reply2
    case "${reply2:-Y}" in
      [Nn]*) die "Install Node.js (LTS) from https://nodejs.org and re-run this script." ;;
    esac
    say "Installing Homebrew"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
      || die "Homebrew install failed. Install Node.js (LTS) manually from https://nodejs.org and re-run."
    for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
      [ -x "$b" ] && eval "$("$b" shellenv)" && break
    done
    command -v brew >/dev/null 2>&1 || die "Homebrew installed but not on PATH. Close this window, open a new Terminal, and re-run start.sh."
  fi

  say "Installing Node.js via Homebrew"
  brew install node || die "Node install failed. Install Node.js (LTS) manually from https://nodejs.org and re-run."
}

if ! command -v node >/dev/null 2>&1; then
  install_node
fi

command -v node >/dev/null 2>&1 || die "Node.js still not available. Install the LTS version from https://nodejs.org and re-run."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  warn "Node.js 18+ is required (found $(node -v))."
  if command -v brew >/dev/null 2>&1; then
    printf "  Upgrade Node via Homebrew now? [Y/n] "
    read -r reply3
    case "${reply3:-Y}" in
      [Nn]*) die "Update Node.js to v18+ (https://nodejs.org) and re-run." ;;
    esac
    brew upgrade node || brew install node || die "Node upgrade failed. Update Node.js manually from https://nodejs.org and re-run."
    NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$NODE_MAJOR" -lt 18 ] && die "Node is still older than v18. Update it from https://nodejs.org and re-run."
  else
    die "Update Node.js to v18 or newer (https://nodejs.org) and re-run."
  fi
fi
ok "Node $(node -v) / npm $(npm -v)"

# --- 2. .env bootstrap -------------------------------------------------------
say "Configuration"
if [ ! -f .env ]; then
  cp .env.example .env
  ok "Created .env from .env.example"
  warn "Open .env and confirm the paths (SEPHORA_PROJECT_DOCS, COACH_STAGES_DIR, SEPHORA_WORKSPACE_ROOT) point to real folders on this machine."
else
  ok ".env already exists — leaving it as-is"
fi

# --- 3. Install dependencies -------------------------------------------------
say "Installing dependencies (this can take a minute the first time)"
npm install
ok "Dependencies installed"

# --- 4. Launch ---------------------------------------------------------------
say "Starting SDLC Visualizer"
echo "  API : http://localhost:4317"
echo "  Web : $WEB_URL"
echo
echo "  Leave this window open while testing. Press Ctrl+C to stop."

# Open the browser shortly after the dev servers boot (macOS/Linux).
( sleep 4
  if command -v open >/dev/null 2>&1; then open "$WEB_URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$WEB_URL"
  fi ) >/dev/null 2>&1 &

npm run dev

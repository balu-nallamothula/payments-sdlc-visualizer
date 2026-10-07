# SDLC Visualizer

A standalone React + Node app to **visualize** and **drive** the Sephora Agentic SDLC
(`/seph-sdlc`) pipeline.

- **Visualize** — reads `sephora-project-docs` live and normalizes the (wildly varying)
  `metadata.json` state onto one canonical 12-stage model: initiatives → Jiras → stages, with the
  coaching cards from `/seph-sdlc-coach` and the generated artifacts.
- **Execute** — a chat panel that runs the real `/seph-sdlc` engine, streams its work to the
  browser, and lets you answer the pipeline's interactive gates in-page.

It is **read-only** with respect to `sephora-project-docs` — only the chat (the Claude engine)
mutates it, exactly as the CLI would.

## Layout

```
sdlc-visualizer/
  server/   Node + Express (ESM): REST + SSE API and the WebSocket chat gateway
  web/      React + Vite UI (plain JavaScript, no TypeScript)
```

## Setup

Quickest path — the one-shot launcher (checks Node, installs deps, creates `.env`, starts both
servers, opens the browser):

```bash
./start.sh        # or, on macOS Finder, double-click start.command
```

> **Prerequisite:** the app reads a local clone of **`sephora-project-docs`**. Make sure it's at
> `~/workspace/sephora-project-docs` (the default) or set `SEPHORA_PROJECT_DOCS` in `.env` to your
> clone. Without it the server stops on launch with a message telling you exactly what to fix.

Manual setup instead:

```bash
cp .env.example .env      # adjust paths if needed
npm install               # installs server + web workspaces
```

Key `.env` settings:

| Var | Meaning | Default |
|---|---|---|
| `SEPHORA_PROJECT_DOCS` | root of the docs/state repo | `~/workspace/sephora-project-docs` |
| `COACH_STAGES_DIR` | seph-sdlc-coach `stages/` dir | `~/.claude/skills/seph-sdlc-coach/stages` |
| `SEPHORA_WORKSPACE_ROOT` | workspace the pipeline expects | `~/workspace` |
| `CHAT_BACKEND` | `sdk` or `cli` | `cli` |
| `PORT` | API port | `4317` |

## Run

```bash
npm run dev      # starts the API (:4317) and the Vite dev server (:5317)
```

Open http://localhost:5317. The dev server proxies `/api` and `/ws` to the backend.

Production-style:

```bash
npm run build    # builds web/dist
npm start        # server serves the API + the built UI on :4317
```

## Troubleshooting (macOS)

- **Double-click does nothing / `zsh: no such file or directory: …/start.sh`.** The double-click
  path got mangled or the file lost its executable bit (common for folders from Downloads). Run it
  from Terminal instead — this works regardless of the exec bit:

  ```bash
  cd ~/Downloads/sdlc-visualizer    # or wherever it lives
  bash start.sh
  ```

  (Tip: type `cd ` then drag the folder from Finder into Terminal to get the exact path.) To make
  the double-click `start.command` work, run once: `chmod +x start.sh start.command && xattr -dr com.apple.quarantine .`

- **"fsevents.node" Not Opened — Apple could not verify…** Click **Done**. ⚠️ **Not** "Move to
  Trash" (that deletes a dependency). `fsevents` is an optional native file-watcher; the app runs
  fine without it. To stop the prompt: System Settings → Privacy & Security → **Allow Anyway**, or
  `xattr -dr com.apple.quarantine .` in the project folder, then relaunch. If you did click "Move
  to Trash", restore it with `npm install`.

- **`localhost refused to connect` / `ERR_CONNECTION_REFUSED` on :5317.** The web server isn't
  running — and because the API and web start together, a failed API takes the web server down with
  it. **Scroll up in the Terminal** for the real error. The usual cause is a missing docs repo:

  ```
  ✗ SDLC Visualizer cannot start.
  SEPHORA_PROJECT_DOCS points to a folder that does not exist on this machine: …
  ```

  Fix: clone `sephora-project-docs` and put it at `~/workspace/sephora-project-docs`, or set
  `SEPHORA_PROJECT_DOCS` in `.env` to your clone, then re-run `bash start.sh`.

- **Port 5317 already in use.** Vite falls back to the next free port (5318). Open the exact
  `Local:` URL Vite prints in the Terminal.

## The chat (execute) path

`/seph-sdlc` is a prose LLM skill, not a CLI. It asks **mandatory questions** and **stops after
every stage**, so it can't run headlessly — the chat is what makes execution possible: the engine
asks, you answer in the browser, and you issue the next `continue` when ready.

Two interchangeable backends (`CHAT_BACKEND`):

- `sdk` — `@anthropic-ai/claude-agent-sdk` `query()` in streaming-input mode (default).
- `cli` — the `claude` binary with `--input-format/--output-format stream-json`.

### Validate the chat first (Spike 0)

Before relying on the chat, confirm how the engine drives `/seph-sdlc` and how its
`AskUserQuestion` gates surface:

```bash
npm run spike -- inventory-service
```

This runs a read-only `/seph-sdlc status`, then a prompt that triggers an `AskUserQuestion`, and
prints how each message arrives. If the SDK path misbehaves, set `CHAT_BACKEND=cli` and retry.

> The chat drives the pipeline with broad tool permissions (`CHAT_PERMISSION_MODE`, default
> `bypassPermissions`) so git/agents can run unattended, mirroring what you'd approve in the CLI.
> It runs on your machine against your own repos.

## API (read-only)

| Endpoint | Purpose |
|---|---|
| `GET /api/initiatives` | normalized initiative summaries |
| `GET /api/initiatives/:name` | initiative detail + 12-stage pipeline + Jiras |
| `GET /api/initiatives/:name/jiras/:jiraId` | per-Jira detail |
| `GET /api/stages` / `GET /api/stages/:n` | parsed coaching cards |
| `GET /api/reference/:doc` | `intro` / `concepts` / `troubleshooting` markdown |
| `GET /api/artifacts?initiative=&jira=` | artifact file list |
| `GET /api/artifact?path=` | one artifact (sandboxed to the docs root) |
| `GET /api/events` | SSE live-change stream (opt-in) |
| `WS /ws/chat` | chat gateway to `/seph-sdlc` |

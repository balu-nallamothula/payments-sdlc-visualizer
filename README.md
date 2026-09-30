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

```bash
cp .env.example .env      # adjust paths if needed
npm install               # installs server + web workspaces
```

Key `.env` settings:

| Var | Meaning | Default |
|---|---|---|
| `SEPHORA_PROJECT_DOCS` | root of the docs/state repo | `~/sourcecode/Sephora/sephora-project-docs` |
| `COACH_STAGES_DIR` | seph-sdlc-coach `stages/` dir | `~/.claude/skills/seph-sdlc-coach/stages` |
| `SEPHORA_WORKSPACE_ROOT` | workspace the pipeline expects | `~/workspace` |
| `CHAT_BACKEND` | `sdk` or `cli` | `sdk` |
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

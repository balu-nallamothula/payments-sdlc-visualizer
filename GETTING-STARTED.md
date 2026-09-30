# SDLC Visualizer — Getting Started

A quick guide to install and run the SDLC Visualizer on your own Mac so you can test it.
No developer setup knowledge required.

---

## 1. Node.js — installed automatically

The app needs **Node.js**. You don't have to install it yourself: when you start
the app (step 2), the script checks for Node and, if it's missing on your Mac,
**offers to install it for you** (via Homebrew — it will install Homebrew too if
needed). Just answer **Y** at the prompt; you may be asked for your Mac password.

Prefer to do it manually instead? Download the **LTS** installer from
<https://nodejs.org> and run it before step 2.

---

## 2. Start the app

**Easiest (double-click):**

1. Open this folder in **Finder**.
2. Double-click **`start.command`**.
3. A Terminal window opens and does everything automatically:
   installs what's needed, then launches the app.
4. Your browser opens to **http://localhost:5317** after a few seconds.

> First launch takes a minute or two while it downloads dependencies.
> Later launches are fast.

**If the double-click is blocked** (macOS may warn about an unidentified developer):
right-click `start.command` → **Open** → **Open** again to approve it once.

**Alternative (Terminal):**

```bash
cd path/to/sdlc-visualizer
./start.sh
```

---

## 3. Use it

- The app opens at **http://localhost:5317**.
- Keep the Terminal window **open** while you're testing.
- To **stop** the app, click the Terminal window and press **Ctrl + C** (or just close it).
- To start again later, double-click **`start.command`** again.

---

## 4. About the data paths (important)

The visualizer reads live files from a few folders on your machine. On first run,
the script creates a `.env` file. Open it in any text editor and make sure these
point to folders that actually exist on **your** Mac:

| Setting | What it points to |
|---|---|
| `SEPHORA_PROJECT_DOCS` | your local `sephora-project-docs` repo |
| `COACH_STAGES_DIR` | the `seph-sdlc-coach` stage cards under `~/.claude` |
| `SEPHORA_WORKSPACE_ROOT` | the workspace where target repos are cloned |

If those folders don't exist yet, the app still starts, but some panels will be
empty until the paths are correct.

The **chat / execute** feature also needs the `claude` command-line tool installed
and logged in (`CHAT_BACKEND=cli`). Read-only browsing of initiatives and stages
works without it.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Node.js is not installed" | Do step 1 above, then retry. |
| Double-click opens a text editor instead of running | Use the Terminal method, or right-click → Open. |
| Browser didn't open | Manually visit <http://localhost:5317>. |
| Port already in use | Close any earlier Terminal window still running the app. |
| Panels are empty | Check the paths in `.env` (see section 4). |

For the full technical details, see [README.md](README.md).

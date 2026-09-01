---
name: server-startup
description: Kill any stale backend/frontend dev server processes, clear the Next.js build cache, and start both servers fresh for manual testing. Use this after implementing a new feature or fixing a bug, whenever the user asks to "spin up the server", "restart the server", "run it so I can test", or reports the app/rescue page/locate page is broken, stuck, or showing stale data after code changes.
---

# Test server

Restarts this repo's dev stack (FastAPI backend on :8000, Next.js frontend on :3000) from a clean
state. Stale processes left running from a previous session are the most common cause of "the page
is broken" here — they hold the ports, so `start_dev.sh` silently falls back to other ports or
fails outright, and a half-written `.next` webpack cache from overlapping instances can corrupt and
throw `invalid block type` errors that 404 random routes.

Run this any time you've just finished implementing or fixing something in `frontend/` or
`backend/` and need a clean server to verify it against — don't ask, just run it as the last step
before reporting the change is ready to check.

## Steps

1. **Kill anything already running.**
   ```bash
   pkill -f "next dev" 2>/dev/null
   pkill -f "uvicorn main:app" 2>/dev/null
   sleep 1
   ```
   Verify the ports are actually free before moving on:
   ```bash
   lsof -nP -iTCP:8000 -sTCP:LISTEN
   lsof -nP -iTCP:3000 -sTCP:LISTEN
   ```
   Both should print nothing. If something still holds a port, `kill` that PID directly, don't
   just retry the pkill.

2. **Clear the Next.js build cache.** A cache left behind by two overlapping dev servers is the
   known cause of routes intermittently 404ing after a restart:
   ```bash
   rm -rf frontend/.next
   ```

3. **Start both servers via the repo's own launcher, in the background:**
   ```bash
   ./start_dev.sh
   ```
   Use `run_in_background: true` (Bash tool) — this script blocks on `wait` and never exits on its
   own. Do not run it in the foreground.

4. **Confirm both are actually up** before telling the user it's ready. Poll the output file (or
   use Monitor) for the readiness lines rather than sleeping a fixed guess:
   ```bash
   until grep -qE "Ready in|Application startup complete|Address already in use|Error" <output-file>; do sleep 1; done
   ```
   Then sanity-check the two beats respond:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/docs
   ```
   Both should be `200`. If either isn't, read the tail of the output file — don't guess.

5. **Report the two URLs** (backend `:8000` / frontend `:3000`, docs at `:8000/docs`) and that the
   database/artifacts were left untouched — this skill only restarts processes, it does not wipe
   `backend/data/sar.db`. If the user specifically wants a clean database too, that's a separate,
   explicit ask (see the "wipe DB" step from prior sessions) — never delete `sar.db` as part of a
   routine restart.

## Notes

- `start_dev.sh` creates the backend venv and runs `pip install -r requirements.txt` / `npm install`
  automatically if missing, so first-run setup is already handled — no need to do that separately.
- If two background dev-server tasks end up running at once (e.g. an old one from a prior turn
  wasn't stopped before this skill launched a new one), that's exactly the overlapping-cache
  scenario that corrupts `.next` — always kill-and-verify (step 1) before launching, never launch a
  second instance on top of a possibly-still-running one.

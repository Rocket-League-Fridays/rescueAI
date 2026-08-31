# Decisions (why the repo looks like this)

These were agreed while scaffolding. Do not silently reverse them.

## D1 — Foundation only, not the full WBS

**Decision:** Scaffold contracts, factories, job state machine, local storage, and a dashboard shell. Do not implement YOLO, SAHI, DEM fetch, A*, or live video in the first pass.

**Why:** Four people need a shared language first. Building the engines in the same PR would collide on types and folder layout.

## D2 — Hybrid directory layout

**Decision:** Keep the spec’s `/backend` and `/frontend` at the repo root (not AGENTS.md’s `server/` + `web/`). Add AGENTS.md layers **inside** those trees: `dao/interface`, factories, presenters, stubs.

**Why:** The product spec named `/backend` and `/frontend`. AGENTS.md’s patterns still apply; only the top-level names differ.

**Rejected:** Literal `shared/` + `server/` + `web/` (would fight the spec). Literal spec-only folders with no DAOs (would fight AGENTS.md).

## D3 — Monorepo lives in this repo root

**Decision:** `rescueAI` **is** the monorepo. Do not nest a `sar-production/` folder.

## D4 — Metadata in SQLite, binaries on disk

**Decision:**

- Jobs, telemetry, detections, landing zones, routes, artifact **metadata** → SQLite via DAO interfaces (`backend/dao/sqlite/`).
- Raw video, frames, annotated frames → local filesystem via `ArtifactStore` (`backend/data/artifacts/`).
- Never put 4K blobs in SQLite.

**Why:** The team will need a real DB for photos/video **metadata**. Binaries belong in object storage in production (S3). The interfaces stay the same; only the factory impl changes.

**Rejected:** In-memory only (dies on restart, painful for CV iteration). JSON files (weak relations). Blobs in SQLite.

**Later:** `DynamoDaoFactory` or `PostgresDaoFactory` + `S3ArtifactStore`. No service code changes.

## D5 — Job is the unit of async work

**Decision:** Every ingest creates a `Job` with `queued | processing | completed | failed` and optional `failureReason`. Heavy work runs in FastAPI `BackgroundTasks` (`JobProcessor`).

**Why:** AGENTS.md requires operator-visible failure reasons and a diagnosable run without re-firing paid/slow work. Stubs still write status so the state machine is real on day one.

## D6 — Pydantic is the HTTP contract; TypeScript is hand-mirrored

**Decision:** FastAPI/Pydantic is source of truth for JSON. Frontend types in `frontend/src/types/telemetry.ts` match field-for-field (camelCase). No OpenAPI codegen yet.

**Why:** Fast to stand up. If drift becomes a problem, add codegen later — do not invent a third schema language now.

## D7 — Domain objects vs HTTP schemas

**Decision:** DAOs and services use dataclasses in `backend/models/domain.py`. Routes accept/return Pydantic models in `backend/models/schemas.py`. Convert at the boundary (`to_domain` / `from_domain`).

**Why:** Persistence and algorithms should not depend on FastAPI or alias generators.

## D8 — Auth is a seam, not a product

**Decision:** `require_api_key` in `backend/api/dependencies.py`. If `SAR_API_KEY` is unset, requests are open. If set, require `X-API-Key`.

**Why:** Keep the dependency in the graph for later without blocking local work.

## D9 — Frontend uses MVP (Presenter + View interface)

**Decision:** `DashboardPresenter` has no React imports. `page.tsx` implements `DashboardView` with state setters. Leaflet map is a client component loaded with `next/dynamic` (`ssr: false`).

**Why:** AGENTS.md MVP. Presenters stay unit-testable. Leaflet cannot SSR.

## D10 — Docker-free local boot

**Decision:** `start_dev.sh` creates a Python venv, pip installs, npm installs if needed, then runs uvicorn + `npm run dev`. No Compose, no containers.

**Why:** Spec replaced container orchestration with a local init script. Structure stays cloud-ready (interfaces + env config).

## D11 — Structured JSON logs, no payload dumps

**Decision:** `backend/core/logging.py` emits JSON (`event`, `level`, `job_id`, `duration_ms`, `failure_reason`). Do not log full telemetry, prompts, or signed URLs.

## D12 — Repo hosting

**Decision:** GitHub org `Rocket-League-Fridays`, repo `rescueAI`, private (matches other org repos).

## D13 — Recorded DJI ingest, not live radio

**Decision:** Watch `data/inbox/` for Mini 4K MP4/MOV (plus sibling SRT). Dashboard upload reuses the same `JobProcessor`. No DJI SDK / RTMP in this pass.

## D14 — Approximate person coordinates

**Decision:** After CV, `PinholeGeoreferencer` writes optional `Detection.groundPoint` using job (or SRT-derived) telemetry and camera HFOV. Flat earth, not DEM. Member 3 can replace this later with terrain ray-cast without changing the JSON field.

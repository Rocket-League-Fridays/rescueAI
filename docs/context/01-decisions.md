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

## D15 — Incident first, video is a sortie

**Decision:** The product story starts at a distress **Incident** (transcript, subject, trail corridor). A Job is a search sortie attached via `incidentId`. Inbox and upload attach to the open incident when `incidentId` is omitted.

**Why:** Judges see call → corridor → footage → find → LZ, not “submit sample telemetry.”

## D16 — Clothing color match, not face ID

**Decision:** CV scores `clothingMatchScore` (HSV overlap with transcript colors) on person boxes. No face re-ID.

## D17 — Demo GIS uses a cached / synthetic Y DEM

**Decision:** `YTrailGisRouter` reads elevation from a **committed USGS 3DEP tile** — `backend/demo/y_mountain_dem.npz`, 178×160 samples at ~10 m over the Y corridor, fetched once by `backend/scripts/fetch_dem.py` (62 KB). Nothing hits the network at request time. Corridors outside that tile fall back to a synthetic surface, and every `LandingZone` reports which one produced its numbers. No live 3DEP or Overpass on stage.

**Why the cached tile rather than the synthetic:** the synthetic was `elevation = f(distance from trail)` — monotonic, with no ridges. A* over it returned the straight line it was meant to replace, so a working router and a broken one were indistinguishable. Real relief is what makes the search observable: on the demo fixture the direct line crosses 50°, well past what a litter carry can cross.

## D18 — Keyless satellite basemap with trail / road overlays

**Decision:** `TacticalMapCanvas` offers four Leaflet base layers — Esri World Imagery (**default**), OpenTopoMap, USGS Imagery+Topo, OSM Street — plus two overlays on by default: Waymarked Trails (hiking routes) and Esri World Transportation (roads and labels).

**Why:** An operator siting a helicopter LZ and a walk-back needs to see real terrain, vegetation, and road access — flat OSM tiles show none of that. Every source is keyless, so nothing new has to be provisioned for the demo.

**Watch out:** Esri and USGS ArcGIS tiles are `{z}/{y}/{x}`; OSM-style tiles are `{z}/{x}/{y}`. Swapping them yields blank or wrong-location tiles with no error. Each layer sets `maxNativeZoom` so Leaflet upscales past its native resolution instead of requesting 404s.

**Consequence:** Route, LZ, and trail overlays carry dark casing strokes so they stay legible over bright imagery. Leg hues live in `frontend/src/lib/route-colors.ts` and are shared with the elevation chart and waypoint table — change them in one place or the three views stop agreeing.

**Rejected:** Mapbox / MapLibre (needs a key; still out of scope). Google satellite (ToS).

## D19 — Two operational pages: Locate and Rescue

**Decision:** The dashboard is split along the operational story. `/` opens an incident from a
transcript; `/locate/{incidentId}` owns the last-known pin, scan parameters, the drone search
route and its export, sortie attach, and scan results; `/rescue/{incidentId}` owns the subject
fix, ranked landing zones, the walk-back path, and the elevation profile. Both incident pages are
URL-addressable and refetch on their own.

**Why:** The single route conflated data entry with the operational view, and the tactical picture
had no address — a reload mid-incident lost it. The split also matches the work breakdown: Locate
consumes the search planner, Rescue consumes the GIS router.

**Consequences:**

- `mock` is a **reserved incident id**. `/locate/mock` and `/rescue/mock` serve the committed
  fixture with no network at all, so the whole interface demos with zero backend. Fixture data is
  always badged; it must never render unbadged.
- Last-known-good snapshots are cached per incident id in `sessionStorage`. A failed or 404
  refresh re-presents the cached data with a staleness readout — it never blanks the page. Only a
  cold tab with no cache and no server shows an explicit "Incident unavailable" state.
- `DashboardPresenter` / `DashboardView` are replaced by `LocatePresenter` / `RescuePresenter`
  over a shared `IncidentPagePresenter` skeleton. All still React-free, per D9.
- Operator edits to subject fields, corridor buffer, and the last-known pin are a **client-side
  review layer** with per-field `AUTO` / `EDITED` provenance, because the backend has no incident
  PATCH and does not persist those values. See
  [`07-frontend-data-map.md`](07-frontend-data-map.md).

**Rejected:** A global store alone (page 2 blanks on reload). Addressing the fixture by its UUID
(the URL would look indistinguishable from a real incident).

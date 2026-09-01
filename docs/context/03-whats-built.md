# What is built

Honest inventory. If it is not listed as **real**, treat it as a stub or placeholder.

## Real (use it)

### Boot

- [`start_dev.sh`](../../start_dev.sh) — venv, pip, npm, uvicorn + Next.js
- [`backend/requirements.txt`](../../backend/requirements.txt)
- [`frontend/package.json`](../../frontend/package.json)
- [`.gitignore`](../../.gitignore) — venv, `node_modules`, `.next`, `backend/data/`, `*.db`
- Demo fixtures (committed): [`backend/demo/`](../../backend/demo/) — Josh transcript + `y_mountain_trail.geojson`

### Contracts

- Domain dataclasses: [`backend/models/domain.py`](../../backend/models/domain.py) — includes `Incident`, `SituationAssessment`, `Job.incident_id`, `Detection.clothing_match_score`
- Pydantic HTTP models + camelCase aliases: [`backend/models/schemas.py`](../../backend/models/schemas.py)
- TypeScript mirrors: [`frontend/src/types/telemetry.ts`](../../frontend/src/types/telemetry.ts), [`frontend/src/types/incident.ts`](../../frontend/src/types/incident.ts)

### Persistence

- DAO ABCs + `DaoFactory`: [`backend/dao/interface/`](../../backend/dao/interface/)
- SQLite impls: [`backend/dao/sqlite/`](../../backend/dao/sqlite/) — tables include `incidents`, `situations`
- `ArtifactStore` + local disk: [`backend/storage/`](../../backend/storage/)

### API

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/health` | `{"status":"ok"}` |
| `POST` | `/incidents` | Transcript → extract subject/trail → `IncidentOut` |
| `POST` | `/incidents/demo` | Load Josh / Y fixture and open an incident |
| `GET` | `/incidents/fixture` | Fixture transcript text only |
| `GET` | `/incidents/active` | Latest open incident + jobs + situation |
| `GET` | `/incidents/{id}` | Incident detail |
| `POST` | `/telemetry` | JSON `CreateJobRequest` (optional `incidentId`) → `201` + `JobOut` |
| `POST` | `/telemetry/upload` | Form `telemetry` + optional `incidentId` + `video` |
| `GET` | `/jobs/{job_id}` | `JobDetailOut` (ids + nested telemetry/detections/LZs/route/situation) |

Invalid telemetry (e.g. `lat: 200`) → **422**. Missing incident → **404**.

Optional auth: `X-API-Key` when `SAR_API_KEY` is set.

Sorties without `incidentId` attach to the **open** incident when one exists.

### Job worker

- [`backend/tasks/async_workers.py`](../../backend/tasks/async_workers.py) — `processing` → extract → CV → georeference → situation → GIS (situation + trail) → `completed` or `failed` with `failure_reason`
- Structured JSON logs (`event=job_completed` / `job_failed`)

### Video ingest (Member 1 — real)

- [`OpenCvFrameExtractor`](../../backend/services/ingest/opencv_frame_extractor.py) — strided JPEG frames via `ArtifactStore` / `ArtifactDao`
- [`SlidingWindowSahiTiler`](../../backend/services/ingest/sahi_tiler.py) — in-memory 640×640 overlapping tiles (not persisted)
- [`IngestWatcher`](../../backend/services/ingest/folder_watcher.py) — polls `SAR_INGEST_DIR`, debounce, SHA-256 ledger; attaches to the open incident
- DJI `.SRT` parser → job telemetry; else `SAR_DEFAULT_*`
- [`PinholeGeoreferencer`](../../backend/services/ingest/pinhole_georeferencer.py) — optional `groundPoint` on detections (approximate)

### Intake (real)

- [`KeywordTranscriptExtractor`](../../backend/services/intake/transcript_extractor.py) — name / colors / Y-trail keywords (no LLM required)
- [`TrailCatalog`](../../backend/services/intake/trail_catalog.py) — committed GeoJSON corridor
- [`IncidentService`](../../backend/services/intake/incident_service.py)

### Computer vision (Member 2 — real when ultralytics loads)

- [`ClothingScoringCvPipeline`](../../backend/services/cv/clothing_cv_pipeline.py) — SAHI tiles → person detector → restitch → NMS → HSV `clothingMatchScore`
- [`UltralyticsPersonDetector`](../../backend/services/cv/ultralytics_detector.py) — YOLO11n, COCO person class
- [`OpenCvDetectionEvidenceRenderer`](../../backend/services/cv/evidence_renderer.py) — persists the best source frame as an `annotated_frame` with full-frame box, score banner, and enlarged subject crop
- If YOLO is disabled or import fails, `StubCvPipeline` is used (frames still extract)

### Situation (real)

- [`SituationAssessor`](../../backend/services/situation/assessor.py) — best clothing match + pinhole `groundPoint` + HSV green canopy fraction

### GIS (Member 3 — demo-scoped, real)

- [`terrain.py`](../../backend/services/gis/terrain.py) — committed USGS 3DEP tile at ~10 m, bilinearly sampled; synthetic fallback outside it, reported per site
- [`cost_surface.py`](../../backend/services/gis/cost_surface.py) — carry cost: loaded descent weighted above ascent, refuses ground past the carry ceiling
- [`astar.py`](../../backend/services/gis/astar.py) — A* plus a Dijkstra `cost_field` that prices the whole corridor in one sweep
- [`YTrailGisRouter`](../../backend/services/gis/y_trail_router.py) — reachability- and footprint-filtered LZ, then a least-cost carry route onto the trail
- `StubGisRouter` remains as a test double

### Frontend (Member 4)

Two operational pages (D19). Runs end to end with **no backend**; see
[`07-frontend-data-map.md`](07-frontend-data-map.md) for every field it captures and displays.

- Next.js App Router, TypeScript strict, Tailwind, dark tactical theme
- Routes: `/` (open incident) · `/locate/{id}` · `/rescue/{id}` · `mock` id serves the fixture
- Presenters — `LocatePresenter`, `RescuePresenter` over a shared `IncidentPagePresenter`; all React-free (D9)
- `ApiClient` — incidents, jobs, and artifact content URLs; `planSearchRoute` / `getSearchRoute` are wired but not yet served
- **Locate:** draggable last-known pin + uncertainty ring, scan parameters (pattern / altitude AGL / overlap), search-route panel with legs and waypoints, route export, sortie attach, scan-results monitor polling `GET /jobs/{id}` through terminal status
- Sortie telemetry takes lat/lng from the last-known pin and AGL from the scan parameters instead of silently using the Y trailhead
- `StreamViewer` — real source and annotated evidence frames on the Rescue page, with explicit progress / no-detection / failure states; `ScanMonitor` on Locate stays numbers-only
- **Rescue:** subject pin, ranked LZ polygons, per-leg walk-back route, route totals, elevation profile, waypoint table, situation card, clothing-match alert, ground-team brief, path export
- `TacticalMap` — satellite/topo basemaps + trail and road overlays, corridor + buffer; `focus="locate" | "rescue"` selects emphasis
- `RoutePanel` + `ElevationProfile` — route totals, ranked LZ readout, per-leg breakdown, elevation profile, waypoint table (coords / elevation / cumulative distance)
- Subject / buffer / last-known review layer with `AUTO` vs `EDITED` provenance and revert, held client-side until the backend persists it
- Never-blank refresh: last-known-good snapshot per incident id in `sessionStorage`; a failed or 404 refresh re-presents cached data with a staleness badge
- Export — GeoJSON / CSV / KML, written in the browser (`lib/route-export.ts`)
- `frontend/src/lib/geo.ts` — client-side haversine mirroring `route_metrics.haversine_m` so readouts match backend totals
- `frontend/src/lib/route-colors.ts` — one color map per leg kind, shared by map, chart, and tables
- `frontend/src/lib/mock-data.ts` — committed fixture (**Dev · load mock sortie**); metrics computed with the real `route_metrics` math

### Tests (pytest)

- Invalid telemetry → 422
- Valid telemetry → job created, `queued`; completed jobs get an LZ/route from `YTrailGisRouter`
- GET job after create
- Missing job → 404
- `JobDao` save/get round-trip
- `StubGisRouter` returns `[], None`
- OpenCV extractor, SAHI tiler, DJI SRT, watcher, pinhole georeference
- Incident extract + Y corridor + demo API + sortie `incidentId`
- HSV clothing score, NMS, clothing CV pipeline, situation assessor, Y-trail GIS walk-back

## Stubbed (fallback only)

| Interface | Stub | When used |
| --- | --- | --- |
| `CvPipeline` | `services/stubs/cv_pipeline.py` | `SAR_YOLO_ENABLED=false` or ultralytics missing |
| `GisRouter` | `services/stubs/gis_routing.py` | Tests / optional swap |

`FrameExtractor` is `OpenCvFrameExtractor`. `StubFrameExtractor` is a test double if needed.

## Placeholders (UI only)

- [`fixture-search-planner.ts`](../../frontend/src/lib/fixture-search-planner.ts) — draws a lawnmower box so the Locate page is demoable. Geometry only: no terrain, airspace, wind, or battery. Always badged FIXTURE; delete once `POST /incidents/{id}/search-route` answers

## Not in the repo

Live DJI downlink, face ID, AllTrails, live 3DEP/Overpass as the only GIS path, statewide trail graph, custom VisDrone training, Docker, AWS, OpenAPI codegen.

## Demo script

1. `./start_dev.sh`
2. `/` — **Load Josh / Y fixture** → **Open incident** (trail + 80 m buffer)
3. Locate — drag the last-known pin, set altitude / overlap, **Plan search route**, export for the drone operator
4. Drop Mini `DJI_*.MP4` + `.SRT` in `backend/data/inbox/` or **Run scan on footage**
5. Scan results — person box, clothing %, subject fix → **Go to rescue**
6. Rescue — Josh pin, canopy, ranked LZ, walk-back path, elevation profile

No backend? `/locate/mock` and `/rescue/mock` walk the same flow on committed fixture data.

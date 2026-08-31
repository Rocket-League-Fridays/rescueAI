# What is built

Honest inventory. If it is not listed as **real**, treat it as a stub or placeholder.

## Real (use it)

### Boot

- [`start_dev.sh`](../../start_dev.sh) — venv, pip, npm, uvicorn + Next.js
- [`backend/requirements.txt`](../../backend/requirements.txt)
- [`frontend/package.json`](../../frontend/package.json)
- [`.gitignore`](../../.gitignore) — venv, `node_modules`, `.next`, `backend/data/`, `*.db`

### Contracts

- Domain dataclasses: [`backend/models/domain.py`](../../backend/models/domain.py)
- Pydantic HTTP models + camelCase aliases: [`backend/models/schemas.py`](../../backend/models/schemas.py)
- TypeScript mirrors: [`frontend/src/types/telemetry.ts`](../../frontend/src/types/telemetry.ts)

### Persistence

- DAO ABCs + `DaoFactory`: [`backend/dao/interface/`](../../backend/dao/interface/)
- SQLite impls: [`backend/dao/sqlite/`](../../backend/dao/sqlite/)
- `ArtifactStore` + local disk: [`backend/storage/`](../../backend/storage/)

### API

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/health` | `{"status":"ok"}` |
| `POST` | `/telemetry` | JSON `CreateJobRequest` → `201` + `JobOut` (`queued`) |
| `POST` | `/telemetry/upload` | Form `telemetry` (JSON string) + optional `video` file |
| `GET` | `/jobs/{job_id}` | `JobDetailOut` (ids + nested telemetry/detections/LZs/route) |

Invalid telemetry (e.g. `lat: 200`) → **422**.

Optional auth: `X-API-Key` when `SAR_API_KEY` is set.

### Job worker

- [`backend/tasks/async_workers.py`](../../backend/tasks/async_workers.py) — `processing` → extract → CV → georeference → GIS → `completed` or `failed` with `failure_reason`
- Structured JSON logs (`event=job_completed` / `job_failed`)

### Video ingest (Member 1 — real)

- [`OpenCvFrameExtractor`](../../backend/services/ingest/opencv_frame_extractor.py) — strided JPEG frames via `ArtifactStore` / `ArtifactDao`
- [`SlidingWindowSahiTiler`](../../backend/services/ingest/sahi_tiler.py) — in-memory 640×640 overlapping tiles for Member 2 (not persisted)
- [`IngestWatcher`](../../backend/services/ingest/folder_watcher.py) — polls `SAR_INGEST_DIR`, debounce, SHA-256 ledger
- DJI `.SRT` parser → job telemetry; else `SAR_DEFAULT_*`
- [`PinholeGeoreferencer`](../../backend/services/ingest/pinhole_georeferencer.py) — optional `groundPoint` on detections (approximate)

### Frontend shell

- Next.js App Router, TypeScript strict, Tailwind, dark tactical theme
- `DashboardPresenter` + `DashboardView`
- `ApiClient` (`createJob`, `createJobWithVideo`, `getJob`)
- `StreamViewer` — two labeled panes, no decoder
- `TacticalMap` — Leaflet OSM, drone `CircleMarker`, empty route/LZ overlays
- Submit button posts **sample Provo-area telemetry** (hardcoded in `page.tsx`)

### Tests (pytest)

- Invalid telemetry → 422
- Valid telemetry → job created, `queued`
- GET job after create (telemetry echoed; stub results empty)
- Missing job → 404
- `JobDao` save/get round-trip
- `StubGisRouter` returns `[], None`

## Stubbed (replace, do not delete the interface)

| Interface | Stub | Returns today |
| --- | --- | --- |
| `CvPipeline` | `services/stubs/cv_pipeline.py` | `[]` |
| `GisRouter` | `services/stubs/gis_routing.py` | `[], None` |

`FrameExtractor` is **no longer a stub** (`OpenCvFrameExtractor`). `StubFrameExtractor` remains only as a test double if needed.

A job **still completes**. The dashboard will show `completed` with zero detections, zero LZs, no route. That is expected.

## Placeholders (UI only)

- Raw / processed video panes — copy only, no streaming
- Map tiles are OSM; no SAR overlay styling beyond olive/amber path options
- Person-alert banner exists but never fires until CV writes `person` detections

## Not in the repo

YOLO11 / VisDrone weights, NMS, restitch, OpenTopography / USGS 3DEP client, RichDEM slope, A*, live DJI downlink, Mapbox tokens, Docker, AWS, OpenAPI codegen.

## Smoke check (already verified once)

```bash
curl -s localhost:8000/health
# {"status":"ok"}

curl -s -X POST localhost:8000/telemetry \
  -H 'Content-Type: application/json' \
  -d '{"telemetry":{"position":{"lat":40.2338,"lng":-111.6585},"bounds":{"southWest":{"lat":40.22,"lng":-111.68},"northEast":{"lat":40.25,"lng":-111.63}},"altitudeMeters":420,"headingDegrees":135,"gimbal":{"pitchDegrees":-45,"yawDegrees":0,"rollDegrees":0},"timestampUtc":"2026-08-31T20:00:00Z"}}'
# 201, status queued, then worker sets completed
```

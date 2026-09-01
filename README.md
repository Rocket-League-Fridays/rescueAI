# RescueAI — SAR Routing Engine

Search-and-Rescue command app: distress **incident** (transcript → subject + Y-trail corridor) then a drone **sortie** (Mini 4K + SRT → person + clothing match → canopy/coords → LZ and walk-back). FastAPI + Next.js, SQLite metadata, local artifact storage.

**Agents and new teammates:** start at [`docs/context/README.md`](docs/context/README.md) (decisions, architecture, what is built, contracts, ownership). Coding standards: [`AGENTS.md`](AGENTS.md).

## Run locally

```bash
chmod +x start_dev.sh
./start_dev.sh
```

- Frontend: http://localhost:3000
- API: http://localhost:8000
- OpenAPI: http://localhost:8000/docs

The script creates `backend/.venv`, installs Python and npm dependencies, then starts uvicorn and Next.js together.

### Backend only

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend only

```bash
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL` if the API is not on `http://localhost:8000`.

## DJI Mini 4K drop folder

Copy a recorded Mini 4K `.mp4` / `.mov` (and the sibling `.SRT` if DJI Fly wrote one) into `backend/data/inbox/`. The watcher waits until the copy finishes, creates a job, extracts JPEG frames, and hands them to `CvPipeline`.

- Telemetry comes from the SRT (mid-clip GPS/alt/gimbal) when present; otherwise `SAR_DEFAULT_LAT` / `SAR_DEFAULT_LNG`.
- The same OpenCV extractor runs for dashboard `POST /telemetry/upload`; dashboard latitude,
  longitude, and AGL fields become the sortie telemetry.
- Inbox jobs attach to the **open incident** (open one from the dashboard first).
- Person coordinates (`groundPoint`) are a **flat-earth pinhole estimate**, not DEM-accurate.
- Clothing match is HSV color overlap with the transcript — not face ID.
- Do not drop live radio streams here. This is recorded-file ingest only.

## Hackathon demo

1. `./start_dev.sh`
2. **Load Josh / Y fixture** → **Open incident** — trail + ~80 m buffer on the map.
3. Drop a pre-recorded Mini `DJI_*.MP4` + `.SRT` into `backend/data/inbox/`, or attach the file and coordinates on the dashboard.
4. The dashboard polls the job through YOLO completion, then shows the winning source frame and a boxed **subject found** evidence image. GIS draws the pin, LZ, and walk-back.

Committed demo files live in `backend/demo/` (`josh_y_trail_transcript.txt`, `y_mountain_trail.geojson`, `y_mountain_dem.npz`). GIS reads elevation from a committed USGS 3DEP tile (`y_mountain_dem.npz`, ~10 m); re-fetch with `python scripts/fetch_dem.py`. Nothing hits the network on stage. YOLO11n loads when `ultralytics` is installed (`SAR_YOLO_ENABLED=true`); otherwise frames still extract and GIS can still route from the drone fix.

## Layout

| Path | Role |
| --- | --- |
| `backend/models/` | Domain objects and Pydantic HTTP contracts |
| `backend/dao/interface/` | Persistence abstractions |
| `backend/dao/sqlite/` | SQLite implementations |
| `backend/storage/` | Binary artifact store (local disk now, S3 later) |
| `backend/services/interface/` | CV / GIS / frame-extractor seams |
| `backend/demo/` | Committed Josh transcript + Y-trail GeoJSON |
| `backend/services/intake/` | Transcript extract + trail catalog |
| `backend/services/cv/` | YOLO person detector, NMS, clothing score |
| `backend/services/gis/` | Terrain, carry cost surface, A*, Y-trail router |
| `backend/scripts/fetch_dem.py` | One-off USGS 3DEP fetch for the committed tile |
| `backend/services/ingest/` | OpenCV extractor, SAHI tiler, SRT parser, folder watcher, pinhole georeference |
| `backend/services/stubs/` | CV / GIS fallbacks |
| `backend/tasks/async_workers.py` | Background job processor |
| `frontend/src/types/` | TypeScript mirrors of the HTTP contracts |
| `frontend/src/presenter/` | MVP presenters (no React inside) |

Metadata lives in `backend/data/sar.db`. Videos and frames live in `backend/data/artifacts/`. Both are gitignored.

## WBS ownership

| Member | Owns | Implement against |
| --- | --- | --- |
| 1 — Data pipeline | Ingest, OpenCV frames, SAHI, SRT/watch folder, incident attach | `OpenCvFrameExtractor`, `IngestWatcher`, `IncidentService` |
| 2 — Computer vision | YOLO11 person + clothing HSV + NMS/restitch | `ClothingScoringCvPipeline` |
| 3 — GIS | Cached 3DEP terrain, carry cost surface, A*, LZ + carry route | `YTrailGisRouter` |
| 4 — Frontend | Intake → corridor → find → LZ dashboard | `DashboardPresenter`, `TacticalMap` |

Do not instantiate SQLite or stub classes outside `main.py` / factories. Inject `DaoFactory` and service interfaces.

## Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

- Invalid telemetry → 422
- Valid telemetry → job created (`queued`)
- Job DAO save/get round-trip
- GIS stub returns empty results; Y-trail router returns an LZ and a carry route that ends there
- OpenCV extractor, SAHI tiler, DJI SRT, watcher, pinhole georeference
- Incident extract + corridor + clothing HSV + situation + inbox `incidentId`

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `SAR_DATABASE_PATH` | `data/sar.db` | SQLite file |
| `SAR_ARTIFACTS_DIR` | `data/artifacts` | Video/frame bytes |
| `SAR_INGEST_DIR` | `data/inbox` | DJI drop folder |
| `SAR_FRAME_STRIDE` | `15` | Keep every Nth video frame |
| `SAR_MAX_FRAMES` | `40` | Cap extracted frames per job |
| `SAR_CAMERA_HFOV_DEGREES` | `82` | Mini 4K-ish pinhole FOV |
| `SAR_DEFAULT_LAT` / `SAR_DEFAULT_LNG` | Provo-area | Used when no SRT |
| `SAR_DEMO_DIR` | `demo` | Committed transcript + Y GeoJSON |
| `SAR_YOLO_ENABLED` | `true` | Set `false` in tests |
| `SAR_YOLO_MODEL` | `yolo11n.pt` | Ultralytics weights |
| `SAR_API_KEY` | unset (open) | Optional `X-API-Key` gate |
| `SAR_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated origins |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Frontend API base |

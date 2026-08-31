# RescueAI — SAR Routing Engine

Production-oriented Search and Rescue foundation: FastAPI backend, Next.js command dashboard, SQLite metadata, and local artifact storage. Computer vision and GIS engines are stubbed behind interfaces so members can implement in parallel.

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
- The same OpenCV extractor runs for dashboard `POST /telemetry/upload`.
- Person coordinates (`groundPoint` on each detection) are a **flat-earth pinhole estimate**, not DEM-accurate. They stay empty until Member 2 returns boxes.
- Do not drop live radio streams here. This is recorded-file ingest only.

## Layout

| Path | Role |
| --- | --- |
| `backend/models/` | Domain objects and Pydantic HTTP contracts |
| `backend/dao/interface/` | Persistence abstractions |
| `backend/dao/sqlite/` | SQLite implementations |
| `backend/storage/` | Binary artifact store (local disk now, S3 later) |
| `backend/services/interface/` | CV / GIS / frame-extractor seams |
| `backend/services/ingest/` | OpenCV extractor, SAHI tiler, SRT parser, folder watcher, pinhole georeference |
| `backend/services/stubs/` | CV / GIS no-ops |
| `backend/tasks/async_workers.py` | Background job processor |
| `frontend/src/types/` | TypeScript mirrors of the HTTP contracts |
| `frontend/src/presenter/` | MVP presenters (no React inside) |

Metadata lives in `backend/data/sar.db`. Videos and frames live in `backend/data/artifacts/`. Both are gitignored.

## WBS ownership

| Member | Owns | Implement against |
| --- | --- | --- |
| 1 — Data pipeline | Ingest, OpenCV frames, SAHI helper, SRT/watch folder | Done: `OpenCvFrameExtractor`, `SlidingWindowSahiTiler`, `IngestWatcher` |
| 2 — Computer vision | YOLO11 + VisDrone, NMS, restitch to 4K coords | `CvPipeline` in `services/interface/cv_pipeline.py` (replace `StubCvPipeline`) |
| 3 — GIS / A* | DEM fetch, slope map, LZ scanner, terrain-aware A* | `GisRouter` in `services/interface/gis_router.py` (replace `StubGisRouter`) |
| 4 — Frontend | Stream player, map overlays, person-detection alerts | `StreamViewer`, `TacticalMap`, `DashboardPresenter` |

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
- GIS stub returns empty results
- OpenCV extractor writes strided JPEG frames
- SAHI tiler covers a 1280x720 frame with 640 tiles
- DJI SRT parse + watch-folder ingest
- Pinhole georeference (center ≈ aircraft; east offset increases longitude)

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
| `SAR_API_KEY` | unset (open) | Optional `X-API-Key` gate |
| `SAR_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated origins |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Frontend API base |

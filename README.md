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

## Layout

| Path | Role |
| --- | --- |
| `backend/models/` | Domain objects and Pydantic HTTP contracts |
| `backend/dao/interface/` | Persistence abstractions |
| `backend/dao/sqlite/` | SQLite implementations |
| `backend/storage/` | Binary artifact store (local disk now, S3 later) |
| `backend/services/interface/` | CV / GIS / frame-extractor seams |
| `backend/services/stubs/` | No-op implementations |
| `backend/tasks/async_workers.py` | Background job processor |
| `frontend/src/types/` | TypeScript mirrors of the HTTP contracts |
| `frontend/src/presenter/` | MVP presenters (no React inside) |

Metadata lives in `backend/data/sar.db`. Videos and frames live in `backend/data/artifacts/`. Both are gitignored.

## WBS ownership

| Member | Owns | Implement against |
| --- | --- | --- |
| 1 — Data pipeline | FastAPI routes, telemetry validation, OpenCV frame extraction, SAHI tiling, structured logs | `FrameExtractor`, `routes_telemetry.py`, `async_workers.py` |
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

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `SAR_DATABASE_PATH` | `data/sar.db` | SQLite file |
| `SAR_ARTIFACTS_DIR` | `data/artifacts` | Video/frame bytes |
| `SAR_API_KEY` | unset (open) | Optional `X-API-Key` gate |
| `SAR_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated origins |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Frontend API base |

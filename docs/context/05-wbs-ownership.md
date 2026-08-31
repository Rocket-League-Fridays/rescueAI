# WBS ownership

Implement **your** stub. Do not rewrite another member’s interface or the job state machine unless the contract is wrong (then change it in one PR and update `docs/context/04-contracts.md`).

## Member 1 — Data pipeline & API

**Goal:** Ingest 4K drone telemetry/video, extract frames, SAHI-tile, keep the API non-blocking.

**Own**

- `backend/api/routes_telemetry.py`, `routes_jobs.py`, `dependencies.py`
- `backend/core/logging.py`, `core/config.py`
- `FrameExtractor` implementation (replace `StubFrameExtractor`)
- SAHI windowing **as part of extraction or as helpers the CV pipeline calls** — agree with Member 2 so tiles are not invented twice
- `start_dev.sh` / env defaults if boot breaks

**Do not** implement YOLO or A*. Persist frames as `Artifact(kind=frame)` via `ArtifactDao` + `ArtifactStore`.

## Member 2 — Computer vision

**Goal:** VisDrone-tuned YOLO11 on 640×640 tiles, NMS on overlaps, restitch to full-frame boxes.

**Own**

- New impl of `CvPipeline` (do not grow `StubCvPipeline` into a monolith — add a new module)
- Tile inference, NMS, restitch
- Writing `Detection` rows with **full-frame** `bbox`

**Do not** change job status yourself; `JobProcessor` does that. Do not fetch DEMs.

**Wire-up:** `backend/main.py` — pass your class into `DefaultServiceFactory` / `JobProcessor` instead of `StubCvPipeline`.

## Member 3 — GIS & A*

**Goal:** DEM for `telemetry.bounds`, slope map, 100x100 ft LZ scan (slope under 5 degrees), terrain-aware A*.

**Own**

- New impl of `GisRouter`
- DEM client, rasterio/richdem, LZ scanner, A*
- Persist `LandingZone` + `Route`

**Do not** call YOLO. Cost function stays inside `GisRouter`.

**Wire-up:** replace `StubGisRouter` in `backend/main.py`.

## Member 4 — Frontend

**Goal:** Tactical dashboard: processed vs raw video, map overlays, person alerts.

**Own**

- `frontend/src/app/`, `components/`, `presenter/`, `lib/api-client.ts`
- Keep `DashboardPresenter` free of React
- When CV/GIS return data, overlay route, LZs, and alert on `person`

**Do not** duplicate backend types. Extend `telemetry.ts` only when schemas change (same PR as Pydantic).

## Shared / do not “own away”

| Path | Why |
| --- | --- |
| `backend/models/*` | Team contract |
| `backend/dao/interface/*` | Persistence contract |
| `backend/services/interface/*` | Engine contract |
| `backend/main.py` | Composition root — add a constructor arg, don’t dump logic here |
| `docs/context/*` | Update when you change a decision or contract |

## Factory reminder

```text
# allowed
class VisDronePipeline(CvPipeline):
    def __init__(self, artifact_store: ArtifactStore): ...

# in main.py only
cv_pipeline = VisDronePipeline(artifact_store)

# forbidden in routes / JobService / presenters
from dao.sqlite.job_dao import SqliteJobDao
SqliteJobDao(...)
```

# WBS ownership

Implement **your** stub. Do not rewrite another member’s interface or the job state machine unless the contract is wrong (then change it in one PR and update `docs/context/04-contracts.md`).

## Member 1 — Data pipeline & API

**Goal:** Ingest 4K drone telemetry/video, extract frames, SAHI-tile, keep the API non-blocking.

**Own**

- `backend/api/routes_telemetry.py`, `routes_jobs.py`, `routes_incidents.py`, `dependencies.py`
- Intake: `IncidentService`, keyword extractor, `TrailCatalog`, `backend/demo/`
- `backend/core/logging.py`, `core/config.py`
- `OpenCvFrameExtractor` (already wired in `main.py`)
- `SlidingWindowSahiTiler` — Member 2 **calls this**; do not invent a second windowing scheme
- `IngestWatcher` + DJI SRT parser + `IngestLedger` (attach inbox jobs to the open incident)
- `PinholeGeoreferencer` (approximate `groundPoint` only)
- `start_dev.sh` / env defaults if boot breaks

**Do not** implement YOLO or A*. Persist frames as `Artifact(kind=frame)` via `ArtifactDao` + `ArtifactStore`. Do not persist SAHI tiles.

## Member 2 — Computer vision

**Goal:** YOLO11 person boxes on 640×640 tiles, NMS, restitch, clothing-color score (not face ID).

**Own**

- [`ClothingScoringCvPipeline`](../../backend/services/cv/clothing_cv_pipeline.py) (do not grow `StubCvPipeline`)
- Tile inference, NMS, restitch, HSV `clothingMatchScore`
- Writing `Detection` rows with **full-frame** `bbox`

**Do not** change job status yourself; `JobProcessor` does that. Do not fetch DEMs.

**Wire-up:** `backend/main.py` — pass your class into `DefaultServiceFactory` / `JobProcessor` instead of `StubCvPipeline`.

## Member 3 — GIS & A*

**Goal:** Cached/synthetic Y DEM, slope + canopy thresholds, LZ, walk-back onto the trail.

**Own**

- [`YTrailGisRouter`](../../backend/services/gis/y_trail_router.py)
- Consume `SituationAssessment.groundPoint` + `canopyFraction` + `trail_line`
- Persist `LandingZone` + `Route`

**Do not** call YOLO. Cost function stays inside `GisRouter`.

**Wire-up:** replace `StubGisRouter` in `backend/main.py`.

## Member 4 — Frontend

**Goal:** Five-beat dashboard: transcript → corridor → footage → find → LZ.

**Own**

- `frontend/src/app/`, `components/`, `presenter/`, `lib/api-client.ts`, `types/incident.ts`
- Keep `DashboardPresenter` free of React
- Overlay trail/buffer, Josh pin, LZ, walk-back; alert on high `clothingMatchScore`

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

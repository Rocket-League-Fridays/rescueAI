# Architecture

## Runtime shape

```text
Next.js dashboard (:3000)
        |
        | typed fetch (frontend/src/lib/api-client.ts)
        v
FastAPI (:8000)
  routes (thin) --> JobService (facade)
                      |-- DaoFactory --> SQLite DAOs
                      |-- ArtifactStore --> local disk
        |
        | BackgroundTasks
        v
IncidentService (transcript → subject + trail)
  score_likely_locations (GET detail — trail-biased PLS hypotheses)
JobProcessor
  FrameExtractor  --> frames (Artifact metadata + bytes)
  CvPipeline      --> Detection rows (+ clothingMatchScore)
  EvidenceRenderer --> annotated_frame (box + subject zoom)
  SituationAssessor --> SituationAssessment
  GisRouter       --> LandingZone rows + Route (situation + trail)
```

```mermaid
flowchart LR
  ui[Next.js dashboard] --> routes[FastAPI routes]
  routes --> jobService[JobService]
  jobService --> daos[DAO interfaces]
  jobService --> artifacts[ArtifactStore]
  daos --> sqlite[SqliteDaoFactory]
  artifacts --> disk[Local filesystem]
  routes --> worker[JobProcessor]
  worker --> cv[CvPipeline]
  worker --> gis[GisRouter]
  worker --> frames[FrameExtractor]
  worker --> daos
```

## Layers

| Layer | Path | Allowed to know |
| --- | --- | --- |
| HTTP | `backend/api/` | Pydantic schemas, `Depends`, `JobService`, `JobProcessor` |
| Facade | `backend/services/job_service.py` | `DaoFactory`, `ArtifactStore`, schemas ↔ domain |
| Worker | `backend/tasks/async_workers.py` | Service interfaces + DAOs; updates `Job.status` |
| Service interfaces | `backend/services/interface/` | Domain types only |
| Stubs / future impls | `backend/services/stubs/` (then new packages) | Domain types; may use `ArtifactStore` when you add it |
| DAO interfaces | `backend/dao/interface/` | Domain types |
| SQLite | `backend/dao/sqlite/` | SQL + domain mapping |
| Artifact store | `backend/storage/` | bytes + `storage_key` |
| Composition | `backend/main.py` | Concrete types |

Routes must not contain business logic. They parse, call a service, enqueue work, return a schema.

## Composition root

[`backend/main.py`](../../backend/main.py) `create_app()`:

1. `Settings()` from env (`SAR_*`).
2. `SqliteDaoFactory.initialize(database_path)`
3. `LocalArtifactStore.initialize(artifacts_dir)`
4. `OpenCvFrameExtractor`, YOLO `ClothingScoringCvPipeline` (or stub), `YTrailGisRouter`, `SituationAssessor`
5. `DefaultServiceFactory(...)` + `JobProcessor(...)` + `IncidentService`
6. Store factory, processor, and incident service on `app.state` for FastAPI `Depends`

Tests call `create_app(Settings(database_path=tmp, artifacts_dir=tmp))` so they never touch `backend/data/`.

## Job lifecycle

```text
POST /telemetry or POST /telemetry/upload
  validate Pydantic
  persist DroneTelemetry
  persist Job(status=queued)
  optional: ArtifactStore.put + ArtifactDao.save + job.video_artifact_id
  BackgroundTasks.add_task(process_job, job.id)
  return JobOut (still queued)

process_job(job_id)
  status = processing
  frames = FrameExtractor.extract(video) or []
  detections = CvPipeline.process(job, frames)
  georeference + save detections; job.detection_ids = [...]
  situation = SituationAssessor.assess(...)
  (lzs, route) = GisRouter.route(job, telemetry, situation, trail_line)
  save LZs + route; set ids
  status = completed
  on exception: status = failed, failure_reason = classified
```

## Frontend MVP

```text
page.tsx (View implementation)
    --> DashboardPresenter (no React)
          --> ApiClient
                --> POST /incidents, POST /telemetry, GET /jobs/{id}
                --> GET /artifacts/{id}/content
    --> StreamViewer (source frame + boxed evidence)
    --> TacticalMap --> dynamic TacticalMapCanvas (Leaflet)
```

The presenter polls active jobs through completion. Person detections render as a source frame,
boxed evidence frame, subject alert, and map pin even when the clothing score is weak.

## Persistence schema (SQLite)

Tables: `telemetry`, `incidents`, `jobs`, `artifacts`, `detections`, `situations`, `landing_zones`, `routes`, `ingest_ledger`.

- `jobs.detection_ids_json` / `landing_zone_ids_json` are JSON string arrays (denormalized ids for the job row).
- `routes.waypoints_json` is a JSON array of `{lat, lng, elevation_meters}`.
- Foreign keys: job requires telemetry first; artifacts require job first; video id is written on a job update after the artifact row exists.

Schema lives in [`backend/dao/sqlite/connection.py`](../../backend/dao/sqlite/connection.py).

## Config

| Env | Default | Meaning |
| --- | --- | --- |
| `SAR_DATABASE_PATH` | `data/sar.db` | SQLite file (relative to process cwd; `start_dev.sh` sets an absolute path) |
| `SAR_ARTIFACTS_DIR` | `data/artifacts` | Binary root |
| `SAR_API_KEY` | unset | Optional `X-API-Key` |
| `SAR_OPENAI_API_KEY` | unset | Whisper; `StubSpeechToText` when missing |
| `SAR_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Frontend API base |

## Swapping infrastructure later

Add one factory implementation. Do not change `JobService` or routes.

```text
DaoFactory          -> SqliteDaoFactory today
                       DynamoDaoFactory / PostgresDaoFactory later
ArtifactStore       -> LocalArtifactStore today
                       S3ArtifactStore later
CvPipeline          -> ClothingScoringCvPipeline today (StubCvPipeline fallback)
GisRouter           -> YTrailGisRouter today (StubGisRouter is a test double)
FrameExtractor      -> OpenCvFrameExtractor today
SpeechToText        -> OpenAIWhisperTranscriber today (StubSpeechToText if no key)
```

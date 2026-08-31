# Agent onboarding

You are joining a Search and Rescue (SAR) monorepo. The demo story is **distress incident → Y-trail corridor → Mini footage → clothing match → LZ / walk-back**. Four people implement in parallel. Fill in **your seam** without inventing new data shapes or bypassing factories.

## Hard rules

1. **Do not invent types.** Use `backend/models/domain.py` + `backend/models/schemas.py` on the server, and `frontend/src/types/telemetry.ts` on the client. If a field is missing, propose it in both places in the same change. JSON is **camelCase**; Python domain objects are **snake_case**.
2. **Program to interfaces.** Services take `DaoFactory`, `ArtifactStore`, `CvPipeline`, `GisRouter`, `FrameExtractor`. Never `new SqliteJobDao()` or import `dao.sqlite` outside `backend/main.py` / `dao/sqlite/`.
3. **Composition root is `backend/main.py`.** That is the only place that binds stubs or SQLite to interfaces. Wire a new implementation there (and in `DefaultServiceFactory` if needed).
4. **Jobs always persist status + `failureReason`.** Never leave a job stuck in `processing` with only a log line. Classify failures (`missing_telemetry`, `missing_artifact`, `processing_error: ...`).
5. **Do not store video bytes in SQLite.** Metadata in DAOs; bytes in `ArtifactStore`.
6. **Do not expand past the talk.** See [06-out-of-scope.md](06-out-of-scope.md). No live DJI, face ID, or AllTrails.
7. **Follow [`AGENTS.md`](../../AGENTS.md):** constructor injection, simple constructors, structured JSON logs, no narration comments, no secrets in logs.

## First 10 minutes

1. Read [01-decisions.md](01-decisions.md) and [03-whats-built.md](03-whats-built.md).
2. Read [05-wbs-ownership.md](05-wbs-ownership.md) and open only your interface + stub.
3. Run `./start_dev.sh` or `cd backend && pytest`.
4. Open a demo incident (`POST /incidents/demo`) then drop a Mini 4K MP4 into `backend/data/inbox/` so you have seen a sortie attach and complete.

## How to add your implementation

```text
1. Keep the ABC in services/interface/ unchanged unless the contract is wrong.
2. Add a real class (e.g. services/yolo/visdrone_pipeline.py) that implements the ABC.
3. Register it in backend/main.py instead of the stub.
4. Persist results through existing DAOs (DetectionDao, LandingZoneDao, RouteDao, ArtifactDao).
5. If the worker must call you differently, change JobProcessor — do not add a second job loop.
```

## Local commands

```bash
./start_dev.sh                          # API :8000 + UI :3000
cd backend && source .venv/bin/activate && pytest
cd frontend && npm run lint && npx tsc --noEmit
```

OpenAPI: http://localhost:8000/docs

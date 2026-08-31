# Out of scope (this foundation)

Do not pull these in “while you are here” unless the team explicitly expands the milestone.

## Engines (WBS, later)

- Downloading YOLO11 / VisDrone weights
- NMS and 4K restitch (Member 2)
- Persisting SAHI tiles to disk (tiler is in-memory only)
- OpenTopography or USGS 3DEP HTTP client
- RichDEM slope rasters
- 100×100 ft LZ scanner
- Terrain A* (`distance + elevation_change * penalty_weight`)
- Live video streaming / frame websocket
- Mapbox (Leaflet + OSM is the current map)

## Platform

- Docker / Compose
- AWS (Lambda, S3, Dynamo, API Gateway) — interfaces are the preparation
- OpenAPI TypeScript codegen
- Real auth (OAuth, Cognito) — API key seam only
- Postgres / Dynamo — SQLite until a factory swap is scheduled

## Process anti-patterns

- Second job queue next to `JobProcessor` + `BackgroundTasks`
- Retrying the same stub/prompt in a loop “to be safe”
- Silent `except: pass` around CV/GIS
- Storing mp4/png bytes in SQLite
- New telemetry field on the frontend only
- Putting React hooks inside `frontend/src/presenter/`

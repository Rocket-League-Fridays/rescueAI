# Out of scope (this foundation / talk)

Do not pull these in “while you are here” unless the team explicitly expands the milestone.

## Not for the talk

- Live DJI downlink / SDK / RTMP
- Face ID or re-identification
- AllTrails (use committed OSM-derived GeoJSON only)
- On-stage live 3DEP or Overpass as the only GIS path
- Full statewide trail graph
- Training a custom VisDrone model unless it is already working a day early

## Still later

- Persisting SAHI tiles to disk (tiler is in-memory only)
- OpenTopography or a USGS 3DEP HTTP client **at request time**. `backend/scripts/fetch_dem.py` is a one-off that writes a committed tile; the serving path only reads that file
- RichDEM / rasterio production slope rasters
- Helicopter-scale A* (the demo route is subject → LZ only; see D20)
- Live video streaming / frame websocket
- Mapbox / MapLibre (Leaflet is the map; basemaps are keyless Esri imagery, OpenTopoMap, USGS, and OSM)

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

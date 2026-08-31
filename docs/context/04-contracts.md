# Shared contracts

JSON on the wire is **camelCase**. Python domain/SQLite columns are **snake_case**. Pydantic `alias_generator=to_camel` + `populate_by_name=True` bridges them.

If you add a field: update `domain.py`, `schemas.py`, `telemetry.ts`, and the SQLite row mapping in the same change.

## Enums

| Name | Values |
| --- | --- |
| `JobStatus` | `queued`, `processing`, `completed`, `failed` |
| `ArtifactKind` | `raw_video`, `frame`, `annotated_frame` |
| `DetectionClassName` | `person`, `vehicle`, `other` |

## Geo / camera

```text
GeoPoint        lat: -90..90, lng: -180..180
GeoBounds       southWest, northEast: GeoPoint
Gimbal          pitchDegrees, yawDegrees, rollDegrees: -180..180
BoundingBox     x >= 0, y >= 0, width > 0, height > 0   (full-frame pixels)
```

## DroneTelemetry

Member 1 validation surface. Required on `POST /telemetry`.

| JSON | Domain | Notes |
| --- | --- | --- |
| `id` | `id` | Server-generated UUID (response only) |
| `position` | `position` | Current drone lat/lng |
| `bounds` | `bounds` | AOI for GIS |
| `altitudeMeters` | `altitude_meters` | -500..40000 |
| `headingDegrees` | `heading_degrees` | 0..360 |
| `gimbal` | `gimbal` | pitch/yaw/roll |
| `timestampUtc` | `timestamp_utc` | ISO-8601 |
| `speedMps` | `speed_mps` | optional, >= 0 |
| `batteryPercent` | `battery_percent` | optional, 0..100 |

`CreateJobRequest` is `{ "telemetry": DroneTelemetryIn }` (no `id` on the way in).

## Job

| JSON | Notes |
| --- | --- |
| `id` | UUID |
| `status` | see enum |
| `failureReason` | operator-visible; null when not failed |
| `createdAt`, `updatedAt` | ISO-8601 UTC |
| `telemetryId` | required |
| `videoArtifactId` | null if no upload |
| `detectionIds` | string[] |
| `landingZoneIds` | string[] |
| `routeId` | null until GIS writes a route |

`GET /jobs/{id}` also nests `telemetry`, `detections`, `landingZones`, `route` (`JobDetail`).

## Artifact (metadata only)

| JSON | Notes |
| --- | --- |
| `id`, `jobId` | |
| `kind` | `raw_video` \| `frame` \| `annotated_frame` |
| `storageKey` | path relative to artifact root, e.g. `{jobId}/{artifactId}.mp4` |
| `mimeType` | |
| `width`, `height` | optional |
| `frameIndex` | optional, for extracted frames |

Bytes: `ArtifactStore.put/get/delete(storage_key)`. Keys must not start with `/` or contain `..`.

## Detection (Member 2 output)

| JSON | Notes |
| --- | --- |
| `id`, `jobId` | |
| `className` | `person` \| `vehicle` \| `other` |
| `bbox` | **full 4K frame pixels**, not tile-local |
| `confidence` | 0..1 |
| `frameId` | optional artifact id of the source frame |
| `groundPoint` | optional `{lat, lng}` — **approximate** pinhole projection (Member 1). Not DEM-accurate. |

NMS + restitch happen **inside** `CvPipeline` before you return this list. The worker then runs `DetectionGeoreferencer` before `DetectionDao.save_all`.

## LandingZone / Route (Member 3 output)

**LandingZone:** `id`, `jobId`, `centroid`, `bounds`, `slopeDegrees`, `areaSqFt`.

**RouteWaypoint:** `lat`, `lng`, `elevationMeters`.

**Route:** `id`, `jobId`, `waypoints[]`, `totalCost`, `landingZoneId?`.

A* cost (when you implement it): `cost = distance + (elevation_change * penalty_weight)`. Persist `totalCost` as the sum the algorithm used.

## Service method signatures

```text
FrameExtractor.extract(video_artifact: Artifact) -> list[Artifact]
SahiTiler.tile(image: ndarray) -> list[SahiTile]   # x, y, 640, 640, image (in-memory)
CvPipeline.process(job: Job, frames: list[Artifact]) -> list[Detection]
DetectionGeoreferencer.apply(detections, telemetry, frames, frame_poses?) -> list[Detection]
GisRouter.route(job: Job, telemetry: DroneTelemetry) -> tuple[list[LandingZone], Route | None]
```

Assign new UUIDs inside your implementation. The worker saves lists via `save_all` / `RouteDao.save` and copies ids onto the job.

## DAO methods

| DAO | Methods |
| --- | --- |
| `JobDao` | `save`, `get_by_id`, `update` |
| `TelemetryDao` | `save`, `get_by_id` |
| `ArtifactDao` | `save`, `get_by_id`, `list_by_job_id` |
| `DetectionDao` | `save`, `save_all`, `get_by_id`, `list_by_job_id` |
| `LandingZoneDao` | `save`, `save_all`, `get_by_id`, `list_by_job_id` |
| `RouteDao` | `save`, `get_by_id`, `get_by_job_id` |
| `IngestLedger` | `has_processed(sha256)`, `record(sha256, source_path, job_id)` |

`DaoFactory` has one `create_*_dao()` per interface.

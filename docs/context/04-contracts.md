# Shared contracts

JSON on the wire is **camelCase**. Python domain/SQLite columns are **snake_case**. Pydantic `alias_generator=to_camel` + `populate_by_name=True` bridges them.

If you add a field: update `domain.py`, `schemas.py`, `telemetry.ts` / `incident.ts`, and the SQLite row mapping in the same change.

Contracts the frontend is already built against but the backend has not implemented yet — `SearchRoute`, the search-planner endpoints, and three optional `Incident` fields — live in [`07-frontend-data-map.md`](07-frontend-data-map.md), along with a field-by-field map of what the UI captures and displays.

## Enums

| Name | Values |
| --- | --- |
| `JobStatus` | `queued`, `processing`, `completed`, `failed` |
| `IncidentStatus` | `open`, `closed` |
| `ArtifactKind` | `raw_video`, `frame`, `annotated_frame` |
| `DetectionClassName` | `person`, `vehicle`, `other` |
| `RouteLegKind` | `subject_link`, `off_trail`, `on_trail` |
| `LandingZoneCriterion` | `slope`, `footprint`, `reachability`, `canopy`, `approach_clearance` |

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

`CreateJobRequest` is `{ "telemetry": DroneTelemetryIn, "incidentId"?: string }`. If `incidentId` is omitted, the job attaches to the open incident when one exists.

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
| `incidentId` | optional; search sortie linked to an Incident |

`GET /jobs/{id}` also nests `telemetry`, `artifacts`, `detections`, `landingZones`,
`route`, and `situation` (`JobDetail`). The frontend reads frame bytes from
`GET /artifacts/{artifactId}/content`; storage keys are never constructed in the browser.

## Incident / subject

| JSON | Notes |
| --- | --- |
| `id` | UUID |
| `transcript` | raw distress text |
| `subject.displayName` | e.g. Josh |
| `subject.clothingColors` | `["red", ...]` |
| `subject.notes` | clothing / condition brief from transcript keywords (empty if none) |
| `trailName` | e.g. `Y Mountain Trail` |
| `trailLine` | GeoJSON-derived `GeoPoint[]` |
| `status` | `open` \| `closed` |
| `situationId` | set after a sortie produces a `SituationAssessment` |
| `corridorBufferMeters` | search buffer (default 80) |
| `lastKnownPoint` | lat/lng pair from the transcript, or the trailhead vertex when the call says he started there |
| `lastKnownRadiusMeters` | optional; operator radius is still client-side until PATCH |
| `missingMinutes` | parsed from the call when present; null means the scorer assumes 60 |

`GET /incidents/{id}` also nests `jobs[]`, `situation`, `likelyLocations[]`, and `missingMinutesAssumed`.

## LikelyLocation (Locate hypotheses)

Computed on read — not stored. Trail-biased scores around the point last seen.

| JSON | Notes |
| --- | --- |
| `point` | On or one step off the committed trail |
| `score` | 0..1 after min-max across the returned set |
| `reason` | Why this vertex scored (time, switchback, keyword) |
| `distanceFromPlsMeters` | Along-trail distance from the snapped PLS |

## SituationAssessment

| JSON | Notes |
| --- | --- |
| `detectionId` | winning person (highest `clothingMatchScore`) |
| `groundPoint` | pinhole lat/lng |
| `canopyFraction` | 0..1 HSV green around the box |
| `notes` | operator-visible method string |

## Artifact (metadata only)

| JSON | Notes |
| --- | --- |
| `id`, `jobId` | |
| `kind` | `raw_video` \| `frame` \| `annotated_frame` |
| `storageKey` | path relative to artifact root, e.g. `{jobId}/{artifactId}.mp4` |
| `mimeType` | |
| `width`, `height` | optional |
| `frameIndex` | optional, for extracted frames |

`annotated_frame` evidence uses the same `frameIndex` as its source `frame`, allowing the
dashboard to show the before/after pair.

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
| `clothingMatchScore` | 0..1 HSV overlap with transcript clothing colors |

NMS + restitch happen **inside** `CvPipeline` before you return this list. The worker then runs `DetectionGeoreferencer` before `DetectionDao.save_all`.

## LandingZone / Route (Member 3 output)

**LandingZone:** `id`, `jobId`, `centroid`, `bounds`, `maxSlopeDegrees`, `areaSqFt`, `canopyFraction?`, `suitabilityScore`, `approachBearingsDegrees`, `notes`.

| Field | Meaning |
| --- | --- |
| `maxSlopeDegrees` | Steepest slope anywhere inside `bounds` — **not** the slope at `centroid`. A pad is only as landable as its worst corner |
| `areaSqFt` | Measured from `bounds`, not assumed |
| `canopyFraction` | `null` when no overhead-cover estimate covers this site. **`null` is not a measured zero** — render it as unknown, never as clear |
| `suitabilityScore` | 0..1, higher is better. Orders candidates when a router returns more than one |
| `approachBearingsDegrees` | Compass bearings a helicopter can fly in on without terrain rising through an 8:1 glide surface. **Terrain only** — trees, wires and towers are not modelled. Empty means no usable approach and the pad is not offered |
| `notes` | Which criteria that score actually accounts for |

`GisRouter.route` returns `list[LandingZone]` — today `YTrailGisRouter` returns exactly one, but the plural is deliberate. A real site finder produces ranked candidates; sort by `suitabilityScore` and show `notes` so an operator can see why the top pick won.

`suitabilityScore` is currently slope-only, and `canopyFraction` is always `null` because the only canopy estimate in the system describes the **subject's** surroundings ([`SituationAssessment.canopyFraction`](#situationassessment)), not a candidate pad. Populating it per-site needs georeferenced imagery sampled across the search area — a dependency on the CV seam, not a GIS-local change.

### What a site declares about itself

`assessedCriteria` and `unassessedCriteria` partition every `LandingZoneCriterion`. A site states in structured form what was never checked, so the dashboard can surface it without parsing prose:

```json
"assessedCriteria":   ["slope", "footprint", "reachability"],
"unassessedCriteria": ["canopy", "approach_clearance"]
```

**The UI must render `unassessedCriteria`.** A pad that reads as landable because nobody evaluated its approach is the failure these fields exist to prevent — and a `suitabilityScore` shown without them implies a completeness the number does not have. A test asserts the two lists are disjoint and together cover the whole enum, so adding a criterion forces someone to classify it rather than silently omit it.

**Approach and departure clearance is measured, against terrain only.** [`approach.py`](../../backend/services/gis/approach.py) walks each of 12 compass bearings out to 300 m and asks whether terrain rises through an 8:1 glide surface off the pad. A pad with no clear bearing is not offered at all, and `suitabilityScore` is discounted when the clear bearings contain no opposing pair — a crew that can only come in from one side must take that line whatever the wind is doing.

What it does **not** model: trees, wires, towers, or airspace. A bearing reported clear is clear of *ground*. That is why `approach_clearance` being in `assessedCriteria` still does not mean the site is cleared for an aircraft, and why the notes say so outright.

**Canopy over the pad remains unmeasured.** The only canopy estimate in the system describes the subject's surroundings, not a candidate pad, so `canopyFraction` stays `null` and `canopy` stays in `unassessedCriteria`. Populating it needs georeferenced imagery sampled across the search area — a dependency on the CV seam, not a GIS-local change.

**RouteWaypoint:** `lat`, `lng`, `elevationMeters`.

**Route:** `id`, `jobId`, `waypoints[]`, `totalCost`, `landingZoneId?`, `distanceMeters`, `elevationGainMeters`, `estimatedMinutes`, `inboundMinutes`, `legs[]`, `notes`.

**RouteLeg:** `kind`, `label`, `startIndex`, `endIndex`, `distanceMeters`, `elevationGainMeters`, `estimatedMinutes`.

`totalCost` is the **search cost** the router minimized, not a distance. A* cost (when you implement it): `cost = distance + (elevation_change * penalty_weight)`; persist `totalCost` as the sum the algorithm used. Everything an operator reads comes from the measured fields instead:

| Field | Meaning |
| --- | --- |
| `distanceMeters` | Ground distance along `waypoints` |
| `elevationGainMeters` | Cumulative ascent only (descent is not subtracted) |
| `estimatedMinutes` | The **loaded carry out** — Naismith (12 min/km + 10 min per 100 m ascent) at the carry pace factor |
| `inboundMinutes` | The same path walked **unloaded** on the way in |
| `notes` | Which pace profile and cost rules produced the numbers |

`legs[]` partitions `waypoints` — legs are contiguous and share endpoints (`leg[n].endIndex == leg[n+1].startIndex`), the first starts at `0`, the last ends at `waypoints.length - 1`, and the leg totals sum to the route totals. `YTrailGisRouter` currently emits a **single `subject_link` leg**: the route ends at the landing zone, because that is where the helicopter extracts ([D20](01-decisions.md)). The structure and the other leg kinds remain for routers that add an approach leg. Slice `waypoints[startIndex..endIndex]` to draw or highlight one leg; do not duplicate point data into the leg.

Measurement helpers live in [`backend/services/gis/route_metrics.py`](../../backend/services/gis/route_metrics.py) (`build_leg`, `summarize`, `haversine_m`). A new `GisRouter` implementation should reuse them so the readouts stay consistent across routers.

**Routing is optimised for the carry, not the walk in.** `YTrailGisRouter` searches a least-cost path over [`terrain.py`](../../backend/services/gis/terrain.py) using [`CarryCostSurface`](../../backend/services/gis/cost_surface.py), which weights loaded descent above ascent and refuses ground steeper than `MAX_CARRY_SLOPE_DEGREES`. A slope a team scrambles up is the slope that hurts coming down with a litter, so the returned path is deliberately not the shortest one.

A landing zone is only offered if a carry route actually reaches it. Selection runs one Dijkstra sweep from the subject ([`cost_field`](../../backend/services/gis/astar.py)) and filters candidates on reachability plus **footprint** slope, so a pad whose centroid is flat but whose surroundings are not is rejected.

## Service method signatures

```text
FrameExtractor.extract(video_artifact: Artifact) -> list[Artifact]
SahiTiler.tile(image: ndarray) -> list[SahiTile]   # x, y, 640, 640, image (in-memory)
CvPipeline.process(job: Job, frames: list[Artifact]) -> list[Detection]
DetectionGeoreferencer.apply(detections, telemetry, frames, frame_poses?) -> list[Detection]
GisRouter.route(job, telemetry, situation=None, trail_line=None) -> tuple[list[LandingZone], Route | None]
TranscriptExtractor.extract(transcript) -> TranscriptExtract  # subject, trail_name, last_known, missing_minutes, started_from_trailhead
score_likely_locations(trail, pls, missing_minutes, transcript) -> list[LikelyLocation]
SpeechToText.transcribe(audio_bytes, mime_type, filename) -> str
PersonDetector.detect(image) -> list[RawDetection]
```

Assign new UUIDs inside your implementation. The worker saves lists via `save_all` / `RouteDao.save` and copies ids onto the job.

## DAO methods

| DAO | Methods |
| --- | --- |
| `JobDao` | `save`, `get_by_id`, `update`, `list_by_incident_id` |
| `IncidentDao` | `save`, `get_by_id`, `get_open`, `update` |
| `SituationDao` | `save`, `get_by_id`, `get_by_job_id` |
| `TelemetryDao` | `save`, `get_by_id` |
| `ArtifactDao` | `save`, `get_by_id`, `list_by_job_id` |
| `DetectionDao` | `save`, `save_all`, `get_by_id`, `list_by_job_id` |
| `LandingZoneDao` | `save`, `save_all`, `get_by_id`, `list_by_job_id` |
| `RouteDao` | `save`, `get_by_id`, `get_by_job_id` |
| `IngestLedger` | `has_processed(sha256)`, `record(sha256, source_path, job_id)` |

`DaoFactory` has one `create_*_dao()` per interface.

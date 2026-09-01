# Frontend data map and backend seams

**Who this is for:** anyone building backend for RescueAI. It lists every value the UI *captures*,
every value the UI *displays*, and exactly which contract field each one is bound to. Build to this
and a merge will not change the frontend's data flow.

The frontend is complete and runs with **zero backend**. Unimplemented endpoints degrade to a
labeled placeholder rather than an error, so landing your endpoint lights up UI that already
exists — you should not need to touch `frontend/`.

Related: [`04-contracts.md`](04-contracts.md) is still the contract of record for everything that
already exists. This doc adds what does not exist yet and maps it to screens.

---

## 1. The two pages

| Route | Beat | Owns |
| --- | --- | --- |
| `/` | New incident | Transcript entry only |
| `/locate/{incidentId}` | **Locate** | Last-known pin, scan parameters, search route + export, sortie attach, scan results |
| `/rescue/{incidentId}` | **Rescue** | Subject fix, ranked landing zones, walk-back path, elevation profile, ground-team brief |
| `/locate/mock`, `/rescue/mock` | Fixture | Committed demo data, no network at all |

`mock` is a reserved incident id. Never allocate it to a real row.

---

## 2. Endpoints

### Already implemented — the frontend calls these today

| Method | Path | Called from | Frontend uses |
| --- | --- | --- | --- |
| `POST` | `/incidents` | Open incident | `IncidentOut.id`, then re-fetches detail |
| `POST` | `/incidents/demo` | Demo incident | same |
| `GET` | `/incidents/fixture` | Load Josh / Y fixture | `transcript` only |
| `POST` | `/incidents/transcribe` | Upload call / audio | `transcript` only — fills the textarea; does not open an incident |
| `GET` | `/incidents/{id}` | Every page load and refresh | Full `IncidentDetailOut` |
| `POST` | `/telemetry` | Attach sortie, no video | `JobOut.id` |
| `POST` | `/telemetry/upload` | Attach sortie with video | `JobOut.id` |
| `GET` | `/jobs/{id}` | Page load, and polled every 2.5 s while a scan runs | Full `JobDetailOut` |

`GET /incidents/active` exists but the frontend does not call it — pages address incidents by id
so a reload is deterministic.

### Not implemented — build these (Member: search planning)

```
POST /incidents/{incidentId}/search-route     body SearchPlanRequest  -> SearchRoute  (201)
GET  /incidents/{incidentId}/search-route                             -> SearchRoute  (200 | 404)
```

`404` on GET is normal and means "not planned yet" — the frontend renders an empty planner state,
not an error. A `404`, `405`, or `501` on POST is read as "planner not wired up yet" and shows a
seam message instead of a failure.

### Not implemented — incident field persistence (Member: intake)

There is no incident update endpoint, and `corridor_buffer_meters` is currently a hardcoded `80`
in `IncidentOut.from_domain` that is never stored. A lat/lng pair in the distress transcript is
persisted as `lastKnownPoint` on create. Pin drags, radius, subject edits, and buffer still live
only in the browser (see §3). Suggested shape:

```
PATCH /incidents/{incidentId}
  body: { subject?: {displayName?, clothingColors?, notes?},
          corridorBufferMeters?, lastKnownPoint?, lastKnownRadiusMeters? }
  -> IncidentOut
```

---

## 3. Data the UI captures (intake)

Everything an operator can type, drag, or upload, and where it goes.

| # | UI control | Page | Type | Goes to today | Should go to |
| --- | --- | --- | --- | --- | --- |
| 1 | Transcript textarea | `/` | `string` | `POST /incidents {transcript}` | unchanged |
| 1a | **Call / audio** file | `/` | `File` | `POST /incidents/transcribe` multipart `audio` → textarea | unchanged |
| 2 | Last-known **pin** (draggable) | Locate | `GeoPoint` | Browser override store; coords shown on the incident report | `Incident.lastKnownPoint` |
| 4 | Uncertainty **radius** | Locate | fixed 100 m default | `lastKnown.radiusMeters` | `Incident.lastKnownRadiusMeters` |
| 5 | Subject **display name** | Locate | `string` | Browser override store | `Incident.subject.displayName` |
| 6 | Subject **clothing colors** (comma separated) | Locate | `string[]` lowercased | Browser override store | `Incident.subject.clothingColors` |
| 7 | Subject **notes** | Locate | `string` | Browser override store | `Incident.subject.notes` |
| 8 | **Corridor buffer** (m) | Locate | `number` | Browser override store | `Incident.corridorBufferMeters` |
| 9 | **Recommended rescue route** | Locate | button | `SearchPlanRequest` with fixed corridor+box defaults | unchanged |
| 10 | **Video file** | Locate | `File` | `POST /telemetry/upload` multipart `video` | unchanged |

**Rows 2–8 are a review layer, not a replacement.** The backend extracts subject fields from the
transcript; the operator corrects them. Every one of those fields renders an `AUTO` or `EDITED`
chip and a Revert control, so an operator can always tell the extractor's value from their own.
When persistence lands, the frontend keeps the same UX and stops holding them locally.

**Validation the UI already enforces** — backend validators should not be narrower than these:

| Field | Range |
| --- | --- |
| `lastKnownRadiusMeters` | 50 – 1500 m |
| `altitudeAglMeters` | 30 – 120 m |
| `overlapPercent` | 0 – 90 % |
| `corridorBufferMeters` | 10 – 1000 m |
| latitude / longitude | -90..90 / -180..180, rejected on blur |

**Derived, not entered:** attaching a sortie also sends a `DroneTelemetryIn` stub built from the
last-known pin and altitude (`position`, `bounds` sized from the uncertainty radius,
`altitudeMeters`, `headingDegrees`, `gimbal`, `timestampUtc`). Real values come from the DJI `.SRT`
sidecar on the inbox path; the stub only has to pass `POST /telemetry` validation.

---

## 4. Data the UI displays

### Locate page

| Element | Reads | Behavior when absent |
| --- | --- | --- |
| Map corridor | `Incident.trailLine`, `Incident.corridorBufferMeters` | No corridor drawn |
| Map last-known pin + ring | `lastKnownPoint`, `lastKnownRadiusMeters` | Pin is PLS (coords / trailhead). On Locate the dashed ring centers on `likelyLocations[0]` when present |
| Map likely-location markers | `likelyLocations[]` | Locate focus only; omitted when the trail is empty |
| Map landing zone | Rescue only | Omitted on Locate — no pad until the sortie is analyzed |
| Incident report time missing | `missingMinutes`, `missingMinutesAssumed` | Defaults to 60 min; map popups read ASSUMED |
| Map search pattern | `SearchRoute.legs[]` sliced over `waypoints[]` | Layer omitted |
| Search totals | `distanceMeters`, `estimatedMinutes`, `altitudeAglMeters`, `coverageAreaSqMeters` | Panel shows empty state |
| Search legs list | `legs[].kind \| label \| distanceMeters \| estimatedMinutes` | — |
| Search waypoint table | `waypoints[].lat \| lng \| altitudeAglMeters` | — |
| Planner notes | `SearchRoute.notes` | Line hidden |
| Scan status chip | `Job.status` | `STANDBY` |
| Scan failure line | `Job.failureReason` | Hidden unless `status === "failed"` |
| Scan counters | `detections.length`, person count, max `clothingMatchScore`, `landingZones.length` | Zeroes |
| Subject fix card | `situation.groundPoint`, else best person `Detection.groundPoint` | "Scan running / finished without a fix" |

### Rescue page

| Element | Reads | Behavior when absent |
| --- | --- | --- |
| Map subject pin | best person `Detection.groundPoint`, else `situation.groundPoint` | Pin omitted |
| Map drone fix | `JobDetail.telemetry.position` | Marker omitted |
| Map landing zones | `LandingZone.bounds` (polygon), `centroid`, ranked by `suitabilityScore` | No pads |
| Map walk-back path | `Route.legs[]` sliced over `Route.waypoints[]` | Falls back to one undifferentiated line |
| Route totals | `distanceMeters`, `elevationGainMeters`, `estimatedMinutes` | "No route yet" |
| LZ readout | `centroid`, `maxSlopeDegrees`, `areaSqFt`, `canopyFraction`, `suitabilityScore`, `notes`, `Route.landingZoneId` | "No candidate pads" |
| Leg breakdown | `legs[].kind \| label \| distanceMeters \| elevationGainMeters \| estimatedMinutes` | — |
| Elevation profile | `waypoints[].elevationMeters` vs cumulative haversine distance, banded by leg | "Not enough waypoints" |
| Waypoint table | `waypoints[].lat \| lng \| elevationMeters` + cumulative distance | — |
| Situation card | `situation.groundPoint`, `canopyFraction`, `notes` | Card hidden |
| Subject alert | person `Detection.clothingMatchScore >= 0.12`, `subject.displayName`, `clothingColors` | Alert hidden |
| Ground-team brief | `subject.displayName`, `clothingColors`, `trailName`, `landingZones.length`, `subject.notes` | Em dashes |

### One deliberate looseness

`Detection.clothingMatchScore` is `float = 0.0` (always present, 0..1) in Pydantic but optional in
`telemetry.ts`. The UI reads it as `?? 0` everywhere, so a missing score degrades to "no match"
rather than `NaN`. Keep sending it; the frontend simply does not depend on its presence.

### Read by nothing — do not spend effort making these pretty

`Route.totalCost` (deliberately never shown as a distance), `Detection.bbox`, `Detection.confidence`,
`Detection.frameId`, `Job.telemetryId`, `Job.detectionIds` / `landingZoneIds` / `routeId` (the UI
uses the nested objects from `JobDetail`), `Artifact.*`, `createdAt` / `updatedAt`.

---

## 5. New contract: SearchRoute

Naming and the `legs[]` rule intentionally mirror `Route` / `RouteLeg` so
`backend/services/gis/route_metrics.py` (`build_leg`, `summarize`, `haversine_m`) can be reused.
JSON is camelCase like everything else.

```
SearchPatternKind = corridor_sweep | expanding_box | parallel_track
SearchLegKind     = transit | transect | turn
```

**SearchPlanRequest** (request body)

| Field | Type | Notes |
| --- | --- | --- |
| `incidentId` | string | |
| `lastKnown.point` | GeoPoint | Operator's approximate position |
| `lastKnown.radiusMeters` | number | Uncertainty; the area the pattern must cover |
| `patternKind` | SearchPatternKind | |
| `altitudeAglMeters` | number | 30–120 from the UI |
| `overlapPercent` | number | 0–90 sidelap |
| `trailLine` | GeoPoint[] | optional; fixture corridor sweep follows this |
| `corridorBufferMeters` | number | optional; how far either side of the trail to fly |
| `boxCenter` | GeoPoint | optional; uncertainty circle / box center (likely #1) |

**SearchRoute** (response)

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `incidentId` | string | |
| `jobId` | string \| null | Set once a sortie flies this route |
| `patternKind`, `altitudeAglMeters`, `overlapPercent` | | Echo what was planned |
| `waypoints[]` | `{lat, lng, altitudeAglMeters}` | **AGL**, not MSL |
| `legs[]` | `{kind, label, startIndex, endIndex, distanceMeters, estimatedMinutes}` | See invariant below |
| `distanceMeters` | number | Total track length |
| `estimatedMinutes` | number | Flight time |
| `coverageAreaSqMeters` | number | Rendered as hectares above 1 ha |
| `notes` | string | Shown verbatim to the operator — say what the score/pattern accounts for |

Also add to `Incident`: `lastKnownPoint`, `lastKnownRadiusMeters`, `searchRouteId` (all optional).
Per `04-contracts.md`, that is one change across `domain.py`, `schemas.py`,
`frontend/src/types/incident.ts`, the SQLite row mapping, and the contracts doc.

---

## 6. Invariants the UI depends on

Break these and the display silently goes wrong.

1. **`legs[]` partitions `waypoints[]`.** Contiguous, endpoint-sharing (`leg[n].endIndex ==
   leg[n+1].startIndex`), first starts at `0`, last ends at `waypoints.length - 1`, and leg totals
   sum to the route totals. The map, the leg list, the elevation bands, and the waypoint table all
   slice on these indices. True for both `Route` and `SearchRoute`.
2. **`canopyFraction: null` means unknown, never a measured zero.** Rendered as "unknown".
3. **`totalCost` is a search cost, not a distance.** The UI never displays it; do not repurpose it.
4. **Landing zones are ranked by `suitabilityScore` descending.** Rank 0 is drawn as the top pick;
   `notes` is shown so an operator can see why it won.
5. **JSON is camelCase.** No snake_case leaks through the alias generator.
6. **`GET /jobs/{id}` is safe to poll.** Called every 2.5 s while a job is `queued` or
   `processing`, stopping on a terminal status, on navigation, or after 80 attempts (~3.3 min).
7. **A missing sub-resource is `null`, not an error.** No route, no situation, and no landing zones
   are all normal states with their own empty UI.

---

## 7. Deliberately out of scope for this build

Called out so their absence reads as a decision, not a gap:

- **Live video downlink and frame rendering.** The scan runs on recorded footage. `StreamViewer` is
  a labeled placeholder; detections surface as counts, map pins, and coordinates.
- **Per-frame bounding-box overlay viewer.** Later feature.
- **Realtime push.** Polling only, no websockets.
- **Multi-incident list, history, auth.** One incident at a time.
- **A real search planner in the frontend.**
  [`lib/fixture-search-planner.ts`](../../frontend/src/lib/fixture-search-planner.ts) flies parallel
  tracks along `trailLine` when present, else a lawnmower box. It models no terrain, airspace, wind,
  or battery, is always badged FIXTURE, and should be deleted once the real endpoint answers.

---

## 8. Where the seams are in code

| Seam | File | Swap by |
| --- | --- | --- |
| HTTP calls | `frontend/src/lib/api-client.ts` | Adding a method; `ApiClientError.status` carries the code |
| Incident + job + search route load | `frontend/src/lib/incident-source.ts` | `ApiIncidentSource` is already live; `FixtureIncidentSource` serves the `mock` id |
| Search planning | `frontend/src/lib/search-route-source.ts` | `createSearchRouteSource()` already points at the real endpoint; the fixture is only used for the `mock` incident |
| Operator overrides | `frontend/src/lib/incident-overrides.ts` | Delete a field from `IncidentOverrides` once the backend persists it |
| Last-known-good cache | `frontend/src/lib/incident-snapshot.ts` | Storage-agnostic behind `SnapshotStore` |

Presenters (`frontend/src/presenter/`) contain no React and are constructor-injected, per decision
D9 — they are the place to look for what the UI does with a response, without reading any TSX.

---

## 9. Conformance status

Checked by parsing `backend/models/schemas.py` and `frontend/src/types/*.ts` and diffing them:
**24 types and enums compared, no divergence.** `JobStatus`, `IncidentStatus`, `ArtifactKind`,
`DetectionClassName`, and `RouteLegKind` match `04-contracts.md` exactly, and every nullable
Pydantic field is nullable on the TypeScript side.

The only fields TypeScript carries that Pydantic does not are the three pending `Incident`
additions in §5 (`lastKnownPoint`, `lastKnownRadiusMeters`, `searchRouteId`), all optional, all
listed here as backend work.

# RescueAI "GHOST RECON" UI Overhaul — Implementation Spec

Source of truth for the `ui-overhaul` branch. Every implementation phase must preserve
the functionality checklist in §Functionality. Visual language is in §Design.

**Branch:** `ui-overhaul`  
**Do not edit presenters, types, backend, or lib logic.** The only `frontend/src/lib/` file
that may change is `route-colors.ts` (hex values only; exported names/shape stay).

---

## Hard constraints

- Do **not** touch `backend/`, `frontend/src/presenter/` logic, `frontend/src/lib/` logic
  (api-client, stores, exports, geo, planners), or `frontend/src/types/`.
- Presenters stay React-free (root `AGENTS.md` MVP rule).
- View interfaces are frozen. Components may be renamed/restructured/merged, but every
  View callback and every presenter method call stays wired exactly as today.
- Functionality checklist is law. Losing a provenance chip, export menu, or poll state
  is a failed task.
- No new npm dependencies. Animations are CSS-only (Tailwind keyframes). Keep
  react-leaflet, recharts, Tailwind v3.
- After each phase: `cd frontend && npx tsc --noEmit && npm run lint` must pass.

---

## Design

### Concept

The map **is** the application. It fills the viewport. Panels are translucent glass HUD
cards in two side rails. Chrome is a 44px mission bar with a live UTC clock. Everything
is monospace-labeled, hairline-bordered, corner-bracketed, and animated with restraint.

Hero moments:

1. Scan running — radar sweep over the search ring, pulsing status, live counters.
2. Subject found — red target reticle, evidence frame "TARGET ACQUIRED" + caption bars.
3. Walk-back route — glowing cased route, cyan elevation profile, ground-team brief.

### Palette

Semantic system — one meaning per color, applied everywhere (chips, map, charts, borders).

| Token | Hex | Meaning |
| --- | --- | --- |
| `void` / `surface.base` | `#030608` | Page background |
| `inset` / `surface.sunken` / `surface.input` | `#0A1017` | Wells, inputs |
| `surface.raised` | `#080D14` | Solid fallback under glass |
| `surface.hover` | `#131C27` | Hover |
| `line.soft` | `rgba(148,163,184,0.10)` | Subtle divider |
| `line.DEFAULT` | `rgba(148,163,184,0.14)` | Hairline |
| `line.strong` | `rgba(148,163,184,0.30)` | Emphasis border |
| `ink.50` | `#F2F7FB` | Brightest text |
| `ink.100` / `ink.200` | `#C6D4E1` | Primary / secondary |
| `ink.300` | `#9FB1C1` | Tertiary |
| `ink.400` / `ink.500` | `#5C6E80` | Labels |
| `ink.600` | `#3B4A59` | Placeholder / disabled |
| `signal` / `accent.400` | `#3DD6F5` | Interactive + live only |
| `caution` / `status.probable` | `#FFB020` | Provisional only |
| `confirm` / `status.confirmed` | `#3DDC97` | Confirmed only |
| `target` / `status.critical` | `#FF4D36` | Subject pin + failures |
| `status.searching` | `#3DD6F5` | Work in flight |
| `status.stale` | `#5C6E80` | Cached / auto / closed |

HUD cards: `background: rgba(8,13,20,0.82)` + `backdrop-blur-md`.

Radius: `2px` (`rounded-sm`). No `rounded-lg` / `rounded-md` softness.

Shadows:

- `panel`: `0 0 0 1px rgba(148,163,184,0.10), 0 16px 48px -16px rgba(0,0,0,0.9)`
- `glow` / `glow-cyan`: cyan ring
- `glow-red`, `glow-green` for hero states

### Typography

- Display / headings / buttons: **Space Grotesk** (`--font-sans` via `next/font/google`).
  Tight tracking. Uppercase for buttons and micro-labels.
- Data / labels / coords: **IBM Plex Mono** (`--font-mono`). `tabular-nums`.
  Micro-labels: 10–11px, `tracking-[0.18em]`.
- Body: Space Grotesk 13–14px. Drop Source Sans 3.
- Coordinates: `font-mono text-signal text-[15px]`, format `40.38848° N  111.54479° W`
  when space allows; 5-decimal lat/lng still acceptable in tables.

### Signature details

- **Corner brackets** — reusable `.corners` class: 4 absolutely-positioned 10×10px L-shapes
  on hero cards, evidence frames, subject-fix card.
- **Dot-grid** on non-map surfaces: `radial-gradient(rgba(148,163,184,0.05) 1px, transparent 1px)`
  at 24px + vignette.
- **Live UTC clock** + blinking `●` LINK in the mission bar (`HH:MM:SSZ`).
- **Radar sweep** — rotating conic-gradient disc over the search ring while
  `job.status` is `queued` or `processing`, plus expanding ping ring.
- **Target reticle** subject marker: divIcon, crosshair + rotating dashed ring
  (`spin-slow` 6s), red glow.
- **Count-up** — `useCountUp(value, 500)` in `ui.tsx` for Stat numeric values when
  the displayed string is a number. Non-numeric strings render as-is.
- **Boot-sequence intake** — stagger `boot-in` fade/translate; blinking `▍` cursor.
- **Scanline caption bars** on evidence frames: absolute bottom bar, mono 10px.
- **Chamfered primary buttons** — `clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))`.

Keyframes to add: `spin-slow`, `sweep`, `ping-ring`, `boot-in`, `blink`, keep `pulse-ring`.

### Page layouts

**Mission bar (~44px)** — replaces `CommandHeader` placement. Full-width
`bg-void/80 backdrop-blur`, hairline bottom.

`[◆ RESCUEAI] [OP / incident id] … [01 LOCATE | 02 RESCUE] … [UTC] [LINK ●] [job chip] [NEW INCIDENT] [Refresh]`

`IncidentStageNav` becomes two square segments `01 LOCATE / 02 RESCUE` (readiness
dot semantics unchanged). Shown in the bar when an incident id is known; on `/`
the Rescue tab still points at `rescueTarget`.

**Intake `/`** — full-viewport centered console on dot-grid void. One ~720px
bracketed panel: heading `INITIATE SEARCH`, blinking cursor, terminal textarea,
`TRANSMIT →` (Open incident) + `UPLOAD CALL AUDIO`. Below: timeline
`01 LOCATE ─ 02 SCAN ─ 03 RESCUE` and `LOAD FIXTURE` (Seed data). Error = red
hairline strip.

**Locate `/locate/{id}`** — map `fixed inset-x-0 top-[44px] bottom-0`. Left rail
380px (incident report, subject review, last known + radius). Right rail 380px
(sortie, scan monitor, search route + export). Rails: glass, `overflow-y-auto`,
12px from edges, collapsible headers. Below `lg`: rails stack under map (map 55vh).

**Rescue `/rescue/{id}`** — same shell. Left: subject alert, situation, ground brief.
Right: route panel (totals, LZ, legs, elevation, waypoints, export). Evidence dock:
bottom-center floating strip, two 16:9 thumbs, click → lightbox (ESC / click-out).

### Map + chart

`route-colors.ts` values only:

| Kind | Color |
| --- | --- |
| subject_link | `#FF4D36` |
| off_trail | `#FFB020` |
| on_trail | `#3DDC97` |
| transit | `#5C6E80` |
| transect | `#3DD6F5` |
| turn | `#2A6E80` |

- Trail: casing `#030608`, mid `#5C6E80`, top `#9FB1C1`. Corridor fill `#5C6E80` @ 0.10.
- Last-known: amber pin + dashed ring. Likely locations: amber dots.
- Subject: red target reticle. Drone fix: cyan diamond.
- LZ: green (top pick solid + glow, alternates dashed).
- Elevation: stroke `#3DD6F5`, cyan gradient fill, grid `rgba(148,163,184,0.08)`,
  ticks `#5C6E80`, leg bands 12% opacity.
- Basemap stays Esri satellite. Map filter: `saturate(0.85) brightness(0.9)`.

---

## Functionality

Every item below must survive. Label *semantics* stay; display casing may become
uppercase to match the HUD (e.g. `Open incident` → `TRANSMIT →` is allowed only
where this spec names a new visible label). If this spec does not rename a control,
keep the existing wording.

### A. Global chrome

- Logo / title click → `/`. Visible identity: RescueAI.
- `New incident` link to `/` when on `/locate/{id}` or `/rescue/{id}`.
- Stage nav: two links, always navigable. Steps `1`/`2` (display `01`/`02` OK).
  Labels Locate / Rescue. Active = current page (`aria-current="page"`).
- Rescue readiness dot:
  - Green when `rescueReady === true` — title `Subject fix available`
  - Dim when `rescueReady === false` — title `No subject fix from the scan yet`
  - Hidden when `undefined` — title `Open the rescue beat for the last incident in this tab`
- Fixture banner: chip `Fixture` (probable), text
  `Committed demo data — not a live incident. Nothing here came from a backend.`
- Stale banner: chip `Stale`, `{reason} ({status}). Showing the last good data from {HH:MM:SS}`
- Error banner: `errorMessage` string, critical tone
- Refresh: `Refresh` / `Refreshing…`, disabled while loading

### B. Intake `/`

- Textarea: rows ≥ 7, placeholder `Paste dispatch transcript here, or upload a call`,
  disabled while busy
- Upload audio: accept `audio/*,.mp3,.wav,.m4a,.webm,.ogg`; busy label `Transcribing…`
  (visible label may be `UPLOAD CALL AUDIO`)
- Open incident: disabled when busy or transcript empty; `Re-open incident` if
  `isOpened` is true. Primary visible label may be `TRANSMIT →`
- Seed data / `LOAD FIXTURE`: loads committed fixture (`seedMockIncident`)
- Fixture helper text must remain (committed fixture, no backend, always badged)
- Three-step flow meaning: Locate (translate transcript + pin + search route),
  Scan (footage → subject position), Rescue (LZ + walk-back)
- Error banner under the console
- Stage nav Rescue tab → last-worked id or placeholder, never forced to fixture
  unless that is the store value

### C. Locate `/locate/{id}`

Page states:

- Loading: `Loading incident…`
- Unavailable: title `Incident unavailable`, backend message, subtext
  `Nothing cached in this tab for that id, and the server did not answer.`,
  `Retry` + `New incident`
- Populated: full layout

Incident report (collapsible):

- Title `Incident report`
- Subtitle `{displayName} · {trailName} · last known {lat}, {lng}`
- Status chip: `open` searching / `closed` stale
- Event summary: first 1–2 sentences of transcript
- Subject description when notes exist and are not the extractor placeholder
- Extracted details: Trail, Opened, Time missing (`{n} min`, ` · assumed` when assumed),
  Last known (5 decimals)
- Subject fields with ProvenanceChip + Revert when edited:
  - Display name
  - Clothing colors — placeholder `red, black`, help
    `Comma separated. Drives the CV clothing-match score.`
  - Notes
  - Corridor buffer — min 10, max 1000, step 10, unit meters either side of trail

Last known:

- Title `Last known position` (or equivalent)
- Lat / lng inputs, validated on blur (−90..90 / −180..180), ProvenanceChip, Revert
- Uncertainty radius slider 50–1500, step 25, readout `{value} m`
- Assumed warning:
  `No coordinates came from the transcript — the trailhead is standing in as point last seen. Correct it before planning if you have a better pin.`

Map (locate focus):

- Title `Search area`, subtitle trail or `NO CORRIDOR`
- Header action: `Recommended rescue route` / `Planning…` — plans corridor_sweep 120m 70%
- Layers: Satellite (default), Topo, Imagery + contours, Street
- Overlays: Marked trails, Roads & labels (checked)
- Trail corridor + line, search legs, last-known pin (draggable, "Drag to correct"),
  uncertainty ring, likely-location markers, drone fix, subject pin
- Loading placeholder `Initializing map…`

Search route panel (collapsible):

- Title `Drone search route`
- Subtitle pattern label or `NOT PLANNED`
- Export for operator: GeoJSON / CSV / KML
- Empty: `{plannerMessage}` or `No search route yet — set the pin and plan a scan`
- Stats: Track, Flight time, Altitude, Coverage
- Legs list, waypoint table (`#`, Lat, Lng, AGL), notes

Sortie:

- Title `Attach Mini 4K sortie`
- File `video/*`
- `Run scan on footage` — disabled with no file, loading, or fixture
- `Refresh after inbox drop` — disabled on fixture

Scan monitor:

- Title `Scan results`
- Status chip: `standby` / `queued` / `processing` / `completed` / `failed`
  (tones: neutral / searching+pulse / searching+pulse / confirmed / critical)
- No job: `No sortie attached yet — the scan runs on uploaded or inbox footage`
- Stats: Detections, People, Best match, Landing zones
- Failure: `Scan failed: {reason}` or `Scan failed: no reason recorded`
- Fix card: `Subject fix`, chip `Located`, coords, `{name} · {score}% clothing match · approximate pinhole projection, not DEM-accurate`, `Go to rescue →`
- No-fix: `Scan finished without a subject fix` or
  `Scan running — a position appears here when a match is found`

Polling: every 2500ms, stop on completed/failed, unmount, or 80 attempts.

Search params (if the form is shown): pattern Corridor sweep / Expanding box /
Parallel track; altitude 30–120 step 5; overlap 0–90 step 5; `Plan search route`.

### D. Rescue `/rescue/{id}`

- No incident: empty labeled boxes — `Rescue map` / `No incident started. Open an issue on the locate tab.`;
  `Walk-back route` / `No route planned yet.`; Ground team brief Subject `—`, Clothing
  `not recorded`, Corridor `—`, Landing zones `0 candidates`; Live feed `No footage yet.`
- Unavailable: same as Locate, Retry + `Back to locate`
- Loading: `Loading incident…`

Map (rescue focus): title `Rescue map`; LZ polygons + centroid; walk-back legs;
waypoint markers; fallback line; search route dimmed.

Route panel `Route to subject`:

- Right: subject name or `NO SUBJECT`, Export path
- Empty: `No route yet — process a sortie`
- Totals: Distance, Ascent, On foot
- LZ: `Landing zone · routed` or `Landing zone · top pick`; suitability, centroid,
  Max slope, Area, Canopy, note `Steepest slope anywhere in the pad, not at the centroid`;
  alternates list; empty `No candidate pads`
- Legs with color swatch
- Elevation profile; empty `Not enough waypoints for a profile`
- Waypoint table: `#`, Lat, Lng, Elev, Dist

Subject alert when any person `clothingMatchScore >= 0.12`:

- `Subject match`, chip `Alert` (probable, pulse)
- `{name} · {score}% clothing` or `Person · {score}% clothing`
- `{n} candidate(s) over threshold · {colors}` or `no colors on file`

Situation card: `Situation`, ground point 5 decimals, `Canopy over the subject {n}%`, notes

Ground team brief: Subject, Clothing, Corridor, Landing zones `{n} candidate(s)`, notes

StreamViewer / evidence dock:

- Panel 1 title `Source frame`; empty cycles
  `Attach a recorded sortie to begin analysis` /
  `Extracting frames from sortie…` /
  `Analysis failed` /
  `Analysis complete — no person detected`;
  header `Job {shortId}` or `Standby`
- Panel 2 `{subjectName} located` or `Detection evidence`; empty
  `Running SAHI + YOLO person search…` (or current equivalent)
- Footer when best person: `Subject found · PERSON {confidence}% · CLOTHING {clothingMatch}%`
- Lightbox on thumb click; ESC / click-out closes

### E. Export

| Location | Label | Formats | Payload |
| --- | --- | --- | --- |
| SearchRoutePanel | Export for operator | GeoJSON / CSV / KML | Search waypoints (AGL) |
| RoutePanel | Export path | GeoJSON / CSV / KML | Walk-back waypoints (MSL) |

Menu items: `GeoJSON (.geojson)`, `Waypoints (.csv)`, `KML (.kml)`. Disabled when
no waypoints. Browser-side Blob download. Do not change `route-export.ts`.

### F–K. Status, provenance, validation

Job chip tones: null=`standby`/neutral; queued/processing=searching+pulse;
completed=confirmed; failed=critical.

Provenance: Auto=stale, Edited=probable + Revert, Assumed=neutral.

Ranges: radius 50–1500/25; AGL 30–120/5; overlap 0–90/5; corridor 10–1000/10;
lat −90..90; lng −180..180.

Never-blank: failed refresh shows cached snapshot + Stale banner.
Fixture id `mock` always badged. Planner 404/405/501 → fixture planner +
`plannerMessage` in the empty state, not an error banner.

---

## Implementation phases

0. This document + `ui-overhaul` branch.
1. Tokens + primitives (`tailwind.config.ts`, `globals.css`, `layout.tsx`, `ui.tsx`).
2. Mission bar + banners.
3. Intake landing.
4. Locate shell + rail panels.
5. Rescue shell + evidence dock + elevation.
6. Map canvas + `route-colors.ts` values.
7. Polish: one pulse per view, responsive, tsc/lint/build, mock + live walkthrough.

---

## Token remapping note for Phase 1

Existing class names (`bg-surface-base`, `text-accent-400`, `border-line`,
`status-confirmed`, …) stay. Remap their hex values to the new system so the
whole UI shifts in one pass. Add `signal`, `caution`, `confirm`, `target`, `void`
aliases. `accent.400` becomes cyan (interactive). Caution/amber lives on
`status.probable` and the new `caution` token.

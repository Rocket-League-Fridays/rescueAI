"use client";

import {
  Circle,
  CircleMarker,
  LayersControl,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";
import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "leaflet/dist/leaflet.css";

import { cumulativeDistances, legForWaypointIndex } from "@/lib/geo";
import {
  ROUTE_LEG_COLORS,
  ROUTE_LEG_LABELS,
  SEARCH_LEG_COLORS,
  SEARCH_LEG_LABELS,
} from "@/lib/route-colors";
import type { IncidentDetail, LikelyLocation } from "@/types/incident";
import type { LastKnownPosition, SearchLeg, SearchRoute, SearchWaypoint } from "@/types/search";
import type {
  Detection,
  GeoBounds,
  GeoPoint,
  JobDetail,
  LandingZone,
  RouteLeg,
  RouteWaypoint,
} from "@/types/telemetry";

const FALLBACK_ROUTE_COLOR = "#FFB020";
const CASING_COLOR = "#030608";
const TRAIL_MID = "#5C6E80";
const TRAIL_TOP = "#9FB1C1";
const LZ_TOP = "#3DDC97";
const LZ_ALT = "#5C6E80";
const AMBER = "#FFB020";
const TARGET = "#FF4D36";
const SIGNAL = "#3DD6F5";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Which beat the map is serving. Controls emphasis, not which layers exist. */
export type MapFocus = "locate" | "rescue";

interface TacticalMapCanvasProps {
  incident: IncidentDetail | null;
  job: JobDetail | null;
  focus?: MapFocus;
  lastKnown?: LastKnownPosition | null;
  searchRoute?: SearchRoute | null;
  /** Supplied only by the Locate page; makes the last-known pin draggable. */
  onLastKnownDragged?: (point: GeoPoint) => void;
}

export default function TacticalMapCanvas({
  incident,
  job,
  focus = "rescue",
  lastKnown = null,
  searchRoute = null,
  onLastKnownDragged,
}: TacticalMapCanvasProps) {
  const center = resolveCenter(incident, job, focus, lastKnown);
  const trail = (incident?.trailLine ?? []).map(
    (point) => [point.lat, point.lng] as LatLngExpression,
  );
  const waypoints = job?.route?.waypoints ?? [];
  const legs = job?.route?.legs ?? [];
  const alongPath = cumulativeDistances(waypoints);
  const rankedZones = rankLandingZones(job?.landingZones ?? []);
  const topZone = rankedZones[0] ?? null;
  const subject = bestSubject(job);
  const pin = subject?.groundPoint ?? job?.situation?.groundPoint ?? null;
  const bufferMeters = incident?.corridorBufferMeters ?? 80;
  const isLocate = focus === "locate";

  return (
    <MapContainer
      key={`${incident?.id ?? "idle"}-${focus}`}
      center={center}
      zoom={15}
      maxZoom={19}
      className="h-full w-full"
      scrollWheelZoom
    >
      <BasemapLayers />
      {trail.length > 1
        ? (incident?.trailLine ?? []).map((point, index) => (
            <Circle
              key={`buffer-${index}`}
              center={[point.lat, point.lng]}
              radius={bufferMeters}
              pathOptions={{ color: TRAIL_MID, weight: 0, fillColor: TRAIL_MID, fillOpacity: 0.1 }}
            />
          ))
        : null}
      {trail.length > 1 ? (
        <Polyline
          positions={trail}
          pathOptions={{ color: CASING_COLOR, weight: 9, opacity: 0.5, interactive: false }}
        />
      ) : null}
      {trail.length > 1 ? (
        <Polyline positions={trail} pathOptions={{ color: TRAIL_MID, weight: 6, opacity: 0.55 }} />
      ) : null}
      {trail.length > 1 ? (
        <Polyline positions={trail} pathOptions={{ color: TRAIL_TOP, weight: 2 }} />
      ) : null}
      {searchRoute
        ? searchRoute.legs.map((leg, index) => (
            <SearchLegLine
              key={`search-${index}-${leg.startIndex}`}
              leg={leg}
              positions={searchLegPositions(searchRoute.waypoints, leg)}
              dimmed={!isLocate}
            />
          ))
        : null}
      {!isLocate
        ? rankedZones.map((zone, rank) => (
            <LandingZoneShape key={zone.id} zone={zone} rank={rank} />
          ))
        : null}
      {lastKnown ? (
        <LastKnownOverlay
          lastKnown={lastKnown}
          subjectName={incident?.subject.displayName ?? "Subject"}
          hypothesisCenter={
            isLocate && incident?.likelyLocations?.[0]
              ? incident.likelyLocations[0].point
              : null
          }
          onDragged={onLastKnownDragged}
        />
      ) : null}
      {isLocate
        ? (incident?.likelyLocations ?? []).map((location, rank) => (
            <LikelyLocationMarker
              key={`likely-${rank}-${location.point.lat}-${location.point.lng}`}
              location={location}
              rank={rank}
              assumedTime={incident?.missingMinutesAssumed === true}
            />
          ))
        : null}
      {!isLocate && legs.length > 0
        ? legs.map((leg, index) => (
            <RouteLegLine
              key={`leg-${index}-${leg.startIndex}`}
              leg={leg}
              positions={legPositions(waypoints, leg)}
            />
          ))
        : null}
      {!isLocate && legs.length === 0 ? (
        <FallbackRouteLine positions={toPositions(waypoints)} />
      ) : null}
      {!isLocate
        ? waypoints.map((waypoint, index) => (
            <RouteWaypointMarker
              key={`waypoint-${index}`}
              index={index}
              waypoint={waypoint}
              leg={legForWaypointIndex(legs, index)}
              metersAlongPath={alongPath[index] ?? 0}
            />
          ))
        : null}
      {!isLocate && topZone ? (
        <CircleMarker
          center={[topZone.centroid.lat, topZone.centroid.lng]}
          radius={5}
          pathOptions={{
            color: CASING_COLOR,
            weight: 2,
            fillColor: LZ_TOP,
            fillOpacity: 1,
          }}
        >
          <Popup>
            <PopupBody
              title={`LZ ${shortId(topZone.id)} centroid`}
              rows={[["Center", formatLatLng(topZone.centroid.lat, topZone.centroid.lng)]]}
            />
          </Popup>
        </CircleMarker>
      ) : null}
      {job?.telemetry ? <DroneFixMarker position={job.telemetry.position} /> : null}
      {pin ? (
        <SubjectReticle
          point={pin}
          name={incident?.subject.displayName ?? "Subject"}
          matchPercent={((subject?.clothingMatchScore ?? 0) * 100).toFixed(0)}
        />
      ) : null}
      {lastKnown && (job?.status === "queued" || job?.status === "processing") ? (
        <RadarSweep
          center={
            isLocate && incident?.likelyLocations?.[0]
              ? incident.likelyLocations[0].point
              : lastKnown.point
          }
        />
      ) : null}
      <CursorHud />
    </MapContainer>
  );
}

function BasemapLayers() {
  return (
    <LayersControl position="topright">
      {/* Esri/USGS ArcGIS tiles are {z}/{y}/{x}; OSM-style tiles are {z}/{x}/{y}. */}
      <LayersControl.BaseLayer checked name="Satellite">
        <TileLayer
          attribution='Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={19}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Topo">
        <TileLayer
          attribution='Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          maxNativeZoom={17}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Imagery + contours">
        <TileLayer
          attribution='<a href="https://www.usgs.gov/">USGS</a> The National Map'
          url="https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={16}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Street">
        <TileLayer
          attribution={OSM_ATTRIBUTION}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
        />
      </LayersControl.BaseLayer>
      <LayersControl.Overlay checked name="Marked trails">
        <TileLayer
          attribution='Trails &copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a> (CC-BY-SA)'
          url="https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png"
          maxNativeZoom={18}
        />
      </LayersControl.Overlay>
      <LayersControl.Overlay checked name="Roads &amp; labels">
        <TileLayer
          attribution='Roads &copy; <a href="https://www.esri.com">Esri</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={19}
        />
      </LayersControl.Overlay>
    </LayersControl>
  );
}

function CasedRouteLine({
  positions,
  color,
  children,
}: {
  positions: LatLngExpression[];
  color: string;
  children?: ReactNode;
}) {
  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{ color: CASING_COLOR, weight: 9, opacity: 0.5, interactive: false }}
      />
      <Polyline
        positions={positions}
        pathOptions={{ color, weight: 7, opacity: 0.35, interactive: false }}
      />
      <Polyline positions={positions} pathOptions={{ color, weight: 3 }}>
        {children}
      </Polyline>
    </>
  );
}

function RouteLegLine({ leg, positions }: { leg: RouteLeg; positions: LatLngExpression[] }) {
  if (positions.length < 2) {
    return null;
  }
  return (
    <CasedRouteLine positions={positions} color={ROUTE_LEG_COLORS[leg.kind]}>
      <Popup>
        <PopupBody
          title={leg.label || ROUTE_LEG_LABELS[leg.kind]}
          subtitle={ROUTE_LEG_LABELS[leg.kind]}
          rows={[
            ["Distance", formatMeters(leg.distanceMeters)],
            ["Ascent", `${leg.elevationGainMeters.toFixed(0)} m`],
            ["Estimate", `${leg.estimatedMinutes.toFixed(0)} min`],
            ["Waypoints", `${leg.startIndex}–${leg.endIndex}`],
          ]}
        />
      </Popup>
    </CasedRouteLine>
  );
}

function FallbackRouteLine({ positions }: { positions: LatLngExpression[] }) {
  if (positions.length < 2) {
    return null;
  }
  return <CasedRouteLine positions={positions} color={FALLBACK_ROUTE_COLOR} />;
}

function RouteWaypointMarker({
  index,
  waypoint,
  leg,
  metersAlongPath,
}: {
  index: number;
  waypoint: RouteWaypoint;
  leg: RouteLeg | null;
  metersAlongPath: number;
}) {
  const color = leg ? ROUTE_LEG_COLORS[leg.kind] : FALLBACK_ROUTE_COLOR;
  return (
    <CircleMarker
      center={[waypoint.lat, waypoint.lng]}
      radius={4}
      pathOptions={{ color: CASING_COLOR, weight: 1.5, fillColor: color, fillOpacity: 0.95 }}
    >
      <Popup>
        <PopupBody
          title={`Waypoint ${index}`}
          subtitle={leg ? leg.label || ROUTE_LEG_LABELS[leg.kind] : "Unassigned leg"}
          rows={[
            ["Position", formatLatLng(waypoint.lat, waypoint.lng)],
            ["Elevation", `${waypoint.elevationMeters.toFixed(0)} m`],
            ["Along path", formatMeters(metersAlongPath)],
          ]}
        />
      </Popup>
    </CircleMarker>
  );
}

function LandingZoneShape({ zone, rank }: { zone: LandingZone; rank: number }) {
  const isTopPick = rank === 0;
  const outline = boundsToPolygon(zone.bounds);
  return (
    <>
      <Polygon
        positions={outline}
        pathOptions={{
          color: CASING_COLOR,
          weight: isTopPick ? 7 : 5,
          opacity: 0.5,
          fill: false,
          interactive: false,
        }}
      />
      <Polygon
        positions={outline}
        pathOptions={
          isTopPick
            ? { color: LZ_TOP, weight: 3, fillColor: LZ_TOP, fillOpacity: 0.22 }
            : {
                color: LZ_ALT,
                weight: 2,
                dashArray: "6 6",
                fillColor: LZ_ALT,
                fillOpacity: 0.1,
              }
        }
      >
        <Popup>
          <PopupBody
            title={`LZ ${shortId(zone.id)}`}
            subtitle={isTopPick ? "Top pick" : `Alternate #${rank + 1}`}
            rows={[
              ["Suitability", `${(zone.suitabilityScore * 100).toFixed(0)}%`],
              ["Steepest slope", `${zone.maxSlopeDegrees.toFixed(1)}° (worst point in pad)`],
              ["Area", `${zone.areaSqFt.toFixed(0)} ft²`],
              ["Canopy", formatCanopy(zone.canopyFraction)],
              ["Notes", zone.notes || "—"],
            ]}
          />
        </Popup>
      </Polygon>
    </>
  );
}

function PopupBody({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="min-w-[11rem] text-xs leading-snug">
      <div className="font-semibold">{title}</div>
      {subtitle ? <div className="mb-1 text-[11px] opacity-60">{subtitle}</div> : null}
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="m-0 opacity-60">{label}</dt>
            <dd className="m-0">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SearchLegLine({
  leg,
  positions,
  dimmed,
}: {
  leg: SearchLeg;
  positions: LatLngExpression[];
  dimmed: boolean;
}) {
  if (positions.length < 2) {
    return null;
  }
  const color = SEARCH_LEG_COLORS[leg.kind];
  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color: CASING_COLOR,
          weight: 7,
          opacity: dimmed ? 0.25 : 0.45,
          interactive: false,
        }}
      />
      <Polyline
        positions={positions}
        pathOptions={{
          color,
          weight: leg.kind === "transect" ? 3 : 2,
          opacity: dimmed ? 0.35 : 0.95,
          dashArray: leg.kind === "turn" ? "4 5" : undefined,
        }}
      >
        <Popup>
          <PopupBody
            title={leg.label || SEARCH_LEG_LABELS[leg.kind]}
            subtitle={SEARCH_LEG_LABELS[leg.kind]}
            rows={[
              ["Distance", formatMeters(leg.distanceMeters)],
              ["Estimate", `${leg.estimatedMinutes.toFixed(1)} min`],
              ["Waypoints", `${leg.startIndex}\u2013${leg.endIndex}`],
            ]}
          />
        </Popup>
      </Polyline>
    </>
  );
}

function LikelyLocationMarker({
  location,
  rank,
  assumedTime,
}: {
  location: LikelyLocation;
  rank: number;
  assumedTime: boolean;
}) {
  const fill = rank === 0 ? AMBER : "#FFCE73";
  return (
    <CircleMarker
      center={[location.point.lat, location.point.lng]}
      radius={rank === 0 ? 9 : 7}
      pathOptions={{
        color: CASING_COLOR,
        weight: 2,
        fillColor: fill,
        fillOpacity: 0.92,
      }}
    >
      <Popup>
        <PopupBody
          title={`Likely ${rank + 1}`}
          subtitle={assumedTime ? "Time missing assumed 60 min" : "Trail-biased hypothesis"}
          rows={[
            ["Score", `${Math.round(location.score * 100)}%`],
            ["From PLS", formatMeters(location.distanceFromPlsMeters)],
            ["Why", location.reason],
            ["Position", formatLatLng(location.point.lat, location.point.lng)],
          ]}
        />
      </Popup>
    </CircleMarker>
  );
}

/**
 * The operator's approximate last-known position. Drag handling uses a `divIcon` because
 * Leaflet's default marker icon resolves a bundled image path that breaks under Next, and
 * `CircleMarker` cannot be dragged.
 */
function LastKnownOverlay({
  lastKnown,
  subjectName,
  hypothesisCenter,
  onDragged,
}: {
  lastKnown: LastKnownPosition;
  subjectName: string;
  /** When set, the uncertainty ring is the current-position guess, not the PLS pin. */
  hypothesisCenter: GeoPoint | null;
  onDragged?: (point: GeoPoint) => void;
}) {
  const ring = hypothesisCenter ?? lastKnown.point;
  const draggable = typeof onDragged === "function";
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        html:
          `<div style="width:18px;height:18px;border-radius:9999px;background:${AMBER};` +
          `border:2px solid ${CASING_COLOR};box-shadow:0 0 0 3px rgba(255,176,32,0.28);` +
          `cursor:${draggable ? "grab" : "default"}"></div>`,
      }),
    [draggable],
  );

  return (
    <>
      <Circle
        center={[ring.lat, ring.lng]}
        radius={lastKnown.radiusMeters}
        pathOptions={{
          color: AMBER,
          weight: 1.5,
          dashArray: "5 6",
          fillColor: AMBER,
          fillOpacity: 0.08,
        }}
      />
      <Marker
        position={[lastKnown.point.lat, lastKnown.point.lng]}
        icon={icon}
        draggable={draggable}
        eventHandlers={
          draggable
            ? {
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng();
                  onDragged?.({ lat, lng });
                },
              }
            : undefined
        }
      >
        <Popup>
          <PopupBody
            title={`${subjectName} \u00b7 last known`}
            subtitle={draggable ? "Drag to correct" : "Approximate"}
            rows={[
              ["Position", formatLatLng(lastKnown.point.lat, lastKnown.point.lng)],
              [
                "Uncertainty",
                hypothesisCenter
                  ? `${formatMeters(lastKnown.radiusMeters)} around likely 1`
                  : formatMeters(lastKnown.radiusMeters),
              ],
            ]}
          />
        </Popup>
      </Marker>
    </>
  );
}

function searchLegPositions(waypoints: SearchWaypoint[], leg: SearchLeg): LatLngExpression[] {
  return waypoints
    .slice(leg.startIndex, leg.endIndex + 1)
    .map((waypoint) => [waypoint.lat, waypoint.lng] as LatLngExpression);
}

function rankLandingZones(zones: LandingZone[]): LandingZone[] {
  return [...zones].sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

function legPositions(waypoints: RouteWaypoint[], leg: RouteLeg): LatLngExpression[] {
  return toPositions(waypoints.slice(leg.startIndex, leg.endIndex + 1));
}

function toPositions(waypoints: RouteWaypoint[]): LatLngExpression[] {
  return waypoints.map((waypoint) => [waypoint.lat, waypoint.lng] as LatLngExpression);
}

/** `null` means no canopy estimate covers this pad, which is not the same as measured clear. */
function formatCanopy(fraction: number | null | undefined): string {
  return typeof fraction === "number" ? `${(fraction * 100).toFixed(0)}%` : "unknown";
}

function formatMeters(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
}

function formatLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function bestSubject(job: JobDetail | null): Detection | null {
  const people = (job?.detections ?? []).filter((detection) => detection.className === "person");
  if (people.length === 0) {
    return null;
  }
  return people.reduce((best, current) =>
    (current.clothingMatchScore ?? 0) > (best.clothingMatchScore ?? 0) ? current : best,
  );
}

function resolveCenter(
  incident: IncidentDetail | null,
  job: JobDetail | null,
  focus: MapFocus,
  lastKnown: LastKnownPosition | null,
): LatLngExpression {
  if (focus === "locate" && lastKnown) {
    return [lastKnown.point.lat, lastKnown.point.lng];
  }
  const subject = bestSubject(job);
  if (subject?.groundPoint) {
    return [subject.groundPoint.lat, subject.groundPoint.lng];
  }
  if (incident?.trailLine[0]) {
    return [incident.trailLine[0].lat, incident.trailLine[0].lng];
  }
  if (job?.telemetry) {
    return [job.telemetry.position.lat, job.telemetry.position.lng];
  }
  return [40.24555, -111.62815];
}

function SubjectReticle({
  point,
  name,
  matchPercent,
}: {
  point: GeoPoint;
  name: string;
  matchPercent: string;
}) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        html:
          `<div style="width:36px;height:36px;position:relative;filter:drop-shadow(0 0 8px ${TARGET})">` +
          `<div class="reticle-spin" style="position:absolute;inset:0;border:1px dashed ${TARGET};border-radius:50%"></div>` +
          `<div style="position:absolute;left:50%;top:2px;bottom:2px;width:1px;background:${TARGET};transform:translateX(-50%)"></div>` +
          `<div style="position:absolute;top:50%;left:2px;right:2px;height:1px;background:${TARGET};transform:translateY(-50%)"></div>` +
          `<div style="position:absolute;left:50%;top:50%;width:8px;height:8px;border:1px solid ${TARGET};border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 10px ${TARGET}"></div>` +
          `</div>`,
      }),
    [],
  );
  return (
    <Marker position={[point.lat, point.lng]} icon={icon}>
      <Popup>
        {name} · match {matchPercent}%
      </Popup>
    </Marker>
  );
}

function DroneFixMarker({ position }: { position: GeoPoint }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        html:
          `<div style="width:12px;height:12px;margin:2px;background:${SIGNAL};transform:rotate(45deg);` +
          `box-shadow:0 0 10px ${SIGNAL};border:1px solid ${CASING_COLOR}"></div>`,
      }),
    [],
  );
  return (
    <Marker position={[position.lat, position.lng]} icon={icon}>
      <Popup>Drone / sortie fix</Popup>
    </Marker>
  );
}

function RadarSweep({ center }: { center: GeoPoint }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        iconSize: [180, 180],
        iconAnchor: [90, 90],
        html:
          `<div style="width:180px;height:180px;position:relative;pointer-events:none">` +
          `<div style="position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg, transparent 0 68%, rgba(61,214,245,0.38) 100%);animation:sweep 3.2s linear infinite"></div>` +
          `<div style="position:absolute;inset:18px;border-radius:50%;border:1px solid rgba(61,214,245,0.35);animation:ping-ring 2.4s cubic-bezier(0,0,0.2,1) infinite"></div>` +
          `</div>`,
      }),
    [],
  );
  return <Marker position={[center.lat, center.lng]} icon={icon} interactive={false} />;
}

function CursorHud() {
  const map = useMap();
  const [coords, setCoords] = useState<string | null>(null);
  useMapEvents({
    mousemove(event) {
      setCoords(`${event.latlng.lat.toFixed(5)}°  ${event.latlng.lng.toFixed(5)}°`);
    },
    mouseout() {
      setCoords(null);
    },
  });
  if (!coords) {
    return null;
  }
  return createPortal(
    <div className="pointer-events-none absolute bottom-8 left-2 z-[500] font-mono text-[10px] uppercase tracking-label text-signal">
      {coords}
    </div>,
    map.getContainer(),
  );
}

function boundsToPolygon(bounds: GeoBounds): LatLngExpression[] {
  return [
    [bounds.southWest.lat, bounds.southWest.lng],
    [bounds.southWest.lat, bounds.northEast.lng],
    [bounds.northEast.lat, bounds.northEast.lng],
    [bounds.northEast.lat, bounds.southWest.lng],
  ];
}

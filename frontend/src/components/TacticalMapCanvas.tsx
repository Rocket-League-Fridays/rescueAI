"use client";

import {
  Circle,
  CircleMarker,
  LayersControl,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";

import { cumulativeDistances, legForWaypointIndex } from "@/lib/geo";
import { ROUTE_LEG_COLORS, ROUTE_LEG_LABELS } from "@/lib/route-colors";
import type { IncidentDetail } from "@/types/incident";
import type {
  Detection,
  GeoBounds,
  JobDetail,
  LandingZone,
  RouteLeg,
  RouteWaypoint,
} from "@/types/telemetry";

const FALLBACK_ROUTE_COLOR = "#f0c14b";
/** Dark casing under every colored vector so it reads over both bright imagery and shadowed canopy. */
const CASING_COLOR = "#0b100d";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

interface TacticalMapCanvasProps {
  incident: IncidentDetail | null;
  job: JobDetail | null;
}

export default function TacticalMapCanvas({ incident, job }: TacticalMapCanvasProps) {
  const center = resolveCenter(incident, job);
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

  return (
    <MapContainer
      key={incident?.id ?? "idle"}
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
              pathOptions={{ color: "#8a9a58", weight: 0, fillColor: "#8a9a58", fillOpacity: 0.16 }}
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
        <Polyline positions={trail} pathOptions={{ color: "#8a9a58", weight: 6, opacity: 0.55 }} />
      ) : null}
      {trail.length > 1 ? (
        <Polyline positions={trail} pathOptions={{ color: "#c4d67c", weight: 2 }} />
      ) : null}
      {rankedZones.map((zone, rank) => (
        <LandingZoneShape key={zone.id} zone={zone} rank={rank} />
      ))}
      {legs.length > 0 ? (
        legs.map((leg, index) => (
          <RouteLegLine
            key={`leg-${index}-${leg.startIndex}`}
            leg={leg}
            positions={legPositions(waypoints, leg)}
          />
        ))
      ) : (
        <FallbackRouteLine positions={toPositions(waypoints)} />
      )}
      {waypoints.map((waypoint, index) => (
        <RouteWaypointMarker
          key={`waypoint-${index}`}
          index={index}
          waypoint={waypoint}
          leg={legForWaypointIndex(legs, index)}
          metersAlongPath={alongPath[index] ?? 0}
        />
      ))}
      {topZone ? (
        <CircleMarker
          center={[topZone.centroid.lat, topZone.centroid.lng]}
          radius={5}
          pathOptions={{
            color: CASING_COLOR,
            weight: 2,
            fillColor: "#c4d67c",
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
      {job?.telemetry ? (
        <CircleMarker
          center={[job.telemetry.position.lat, job.telemetry.position.lng]}
          radius={7}
          pathOptions={{
            color: CASING_COLOR,
            weight: 2,
            fillColor: "#f0c14b",
            fillOpacity: 0.95,
          }}
        >
          <Popup>Drone / sortie fix</Popup>
        </CircleMarker>
      ) : null}
      {pin ? (
        <CircleMarker
          center={[pin.lat, pin.lng]}
          radius={10}
          pathOptions={{
            color: CASING_COLOR,
            weight: 2.5,
            fillColor: "#ff6b4a",
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            {incident?.subject.displayName ?? "Subject"} · match{" "}
            {((subject?.clothingMatchScore ?? 0) * 100).toFixed(0)}%
          </Popup>
        </CircleMarker>
      ) : null}
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
            ? { color: "#c4d67c", weight: 3, fillColor: "#c4d67c", fillOpacity: 0.2 }
            : {
                color: "#8a9a58",
                weight: 2,
                dashArray: "6 6",
                fillColor: "#8a9a58",
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

function resolveCenter(incident: IncidentDetail | null, job: JobDetail | null): LatLngExpression {
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

function boundsToPolygon(bounds: GeoBounds): LatLngExpression[] {
  return [
    [bounds.southWest.lat, bounds.southWest.lng],
    [bounds.southWest.lat, bounds.northEast.lng],
    [bounds.northEast.lat, bounds.northEast.lng],
    [bounds.northEast.lat, bounds.southWest.lng],
  ];
}

"use client";

import { Circle, CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

import type { IncidentDetail } from "@/types/incident";
import type { Detection, JobDetail } from "@/types/telemetry";

interface TacticalMapCanvasProps {
  incident: IncidentDetail | null;
  job: JobDetail | null;
}

export default function TacticalMapCanvas({ incident, job }: TacticalMapCanvasProps) {
  const center = resolveCenter(incident, job);
  const trail = (incident?.trailLine ?? []).map(
    (point) => [point.lat, point.lng] as LatLngExpression,
  );
  const routePositions = (job?.route?.waypoints ?? []).map(
    (waypoint) => [waypoint.lat, waypoint.lng] as LatLngExpression,
  );
  const subject = bestSubject(job);
  const pin = subject?.groundPoint ?? job?.situation?.groundPoint ?? null;
  const bufferMeters = incident?.corridorBufferMeters ?? 80;

  return (
    <MapContainer
      key={incident?.id ?? "idle"}
      center={center}
      zoom={15}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {trail.length > 1
        ? (incident?.trailLine ?? []).map((point, index) => (
            <Circle
              key={`buffer-${index}`}
              center={[point.lat, point.lng]}
              radius={bufferMeters}
              pathOptions={{ color: "#8a9a58", weight: 0, fillColor: "#8a9a58", fillOpacity: 0.08 }}
            />
          ))
        : null}
      {trail.length > 1 ? (
        <Polyline positions={trail} pathOptions={{ color: "#8a9a58", weight: 6, opacity: 0.55 }} />
      ) : null}
      {trail.length > 1 ? (
        <Polyline positions={trail} pathOptions={{ color: "#c4d67c", weight: 2 }} />
      ) : null}
      {job?.telemetry ? (
        <CircleMarker
          center={[job.telemetry.position.lat, job.telemetry.position.lng]}
          radius={7}
          pathOptions={{ color: "#f0c14b", fillColor: "#f0c14b", fillOpacity: 0.9 }}
        >
          <Popup>Drone / sortie fix</Popup>
        </CircleMarker>
      ) : null}
      {pin ? (
        <CircleMarker
          center={[pin.lat, pin.lng]}
          radius={10}
          pathOptions={{ color: "#ff6b4a", fillColor: "#ff6b4a", fillOpacity: 0.95 }}
        >
          <Popup>
            {incident?.subject.displayName ?? "Subject"} · match{" "}
            {((subject?.clothingMatchScore ?? 0) * 100).toFixed(0)}%
          </Popup>
        </CircleMarker>
      ) : null}
      {(job?.landingZones ?? []).map((zone) => (
        <Polygon
          key={zone.id}
          positions={boundsToPolygon(zone.bounds)}
          pathOptions={{ color: "#c4d67c", weight: 2 }}
        >
          <Popup>
            LZ {zone.id.slice(0, 8)} · max {zone.maxSlopeDegrees.toFixed(1)}° ·{" "}
            {zone.areaSqFt.toFixed(0)} ft²
          </Popup>
        </Polygon>
      ))}
      {routePositions.length > 1 ? (
        <Polyline positions={routePositions} pathOptions={{ color: "#f0c14b", weight: 3 }} />
      ) : null}
    </MapContainer>
  );
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

function boundsToPolygon(bounds: JobDetail["landingZones"][number]["bounds"]): LatLngExpression[] {
  return [
    [bounds.southWest.lat, bounds.southWest.lng],
    [bounds.southWest.lat, bounds.northEast.lng],
    [bounds.northEast.lat, bounds.northEast.lng],
    [bounds.northEast.lat, bounds.southWest.lng],
  ];
}

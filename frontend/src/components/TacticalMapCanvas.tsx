"use client";

import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

import type { JobDetail } from "@/types/telemetry";

interface TacticalMapCanvasProps {
  job: JobDetail | null;
}

export default function TacticalMapCanvas({ job }: TacticalMapCanvasProps) {
  const center = resolveCenter(job);
  const routePositions = (job?.route?.waypoints ?? []).map(
    (waypoint) => [waypoint.lat, waypoint.lng] as LatLngExpression,
  );

  return (
    <MapContainer
      center={center}
      zoom={13}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {job?.telemetry ? (
        <CircleMarker
          center={[job.telemetry.position.lat, job.telemetry.position.lng]}
          radius={8}
          pathOptions={{ color: "#f0c14b", fillColor: "#f0c14b", fillOpacity: 0.9 }}
        >
          <Popup>Drone position</Popup>
        </CircleMarker>
      ) : null}
      {(job?.landingZones ?? []).map((zone) => (
        <Polygon
          key={zone.id}
          positions={boundsToPolygon(zone.bounds)}
          pathOptions={{ color: "#c4d67c", weight: 2 }}
        >
          <Popup>
            LZ {zone.id.slice(0, 8)} · {zone.slopeDegrees.toFixed(1)}° · {zone.areaSqFt} ft²
          </Popup>
        </Polygon>
      ))}
      {routePositions.length > 1 ? (
        <Polyline positions={routePositions} pathOptions={{ color: "#f0c14b", weight: 3 }} />
      ) : null}
    </MapContainer>
  );
}

function resolveCenter(job: JobDetail | null): LatLngExpression {
  if (job?.telemetry) {
    return [job.telemetry.position.lat, job.telemetry.position.lng];
  }
  return [40.2338, -111.6585];
}

function boundsToPolygon(bounds: JobDetail["landingZones"][number]["bounds"]): LatLngExpression[] {
  return [
    [bounds.southWest.lat, bounds.southWest.lng],
    [bounds.southWest.lat, bounds.northEast.lng],
    [bounds.northEast.lat, bounds.northEast.lng],
    [bounds.northEast.lat, bounds.southWest.lng],
  ];
}

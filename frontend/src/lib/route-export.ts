import type { SearchRoute } from "@/types/search";
import type { Route } from "@/types/telemetry";

/**
 * Hands a planned route to whoever flies or walks it. Everything is generated in the browser
 * from one waypoint array — no backend endpoint and no server round trip.
 */

export type ExportFormat = "geojson" | "csv" | "kml";

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  geojson: "GeoJSON (.geojson)",
  csv: "Waypoints (.csv)",
  kml: "KML (.kml)",
};

/** Format-neutral waypoint. `altitudeMeters` is AGL for a flight plan, MSL for a walk-back. */
export interface ExportWaypoint {
  lat: number;
  lng: number;
  altitudeMeters: number;
}

export interface ExportableRoute {
  name: string;
  description: string;
  waypoints: ExportWaypoint[];
}

export function searchRouteToExportable(route: SearchRoute, incidentLabel: string): ExportableRoute {
  return {
    name: `${incidentLabel} search route`,
    description: route.notes,
    waypoints: route.waypoints.map((waypoint) => ({
      lat: waypoint.lat,
      lng: waypoint.lng,
      altitudeMeters: waypoint.altitudeAglMeters,
    })),
  };
}

export function rescueRouteToExportable(route: Route, incidentLabel: string): ExportableRoute {
  return {
    name: `${incidentLabel} rescue path`,
    description: `Landing zone to subject: ${Math.round(route.distanceMeters)} m, +${Math.round(
      route.elevationGainMeters,
    )} m ascent, ~${Math.round(route.estimatedMinutes)} min on foot.`,
    waypoints: route.waypoints.map((waypoint) => ({
      lat: waypoint.lat,
      lng: waypoint.lng,
      altitudeMeters: waypoint.elevationMeters,
    })),
  };
}

export function toGeoJson(route: ExportableRoute): string {
  const document = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: route.name, description: route.description },
        geometry: {
          type: "LineString",
          coordinates: route.waypoints.map((w) => [w.lng, w.lat, w.altitudeMeters]),
        },
      },
      ...route.waypoints.map((waypoint, index) => ({
        type: "Feature" as const,
        properties: { name: `WP${index}`, altitudeMeters: waypoint.altitudeMeters },
        geometry: {
          type: "Point" as const,
          coordinates: [waypoint.lng, waypoint.lat, waypoint.altitudeMeters],
        },
      })),
    ],
  };
  return JSON.stringify(document, null, 2);
}

export function toWaypointCsv(route: ExportableRoute): string {
  const header = "index,latitude,longitude,altitude_m";
  const rows = route.waypoints.map(
    (waypoint, index) =>
      `${index},${waypoint.lat.toFixed(7)},${waypoint.lng.toFixed(7)},${waypoint.altitudeMeters.toFixed(1)}`,
  );
  return [header, ...rows].join("\n");
}

export function toKml(route: ExportableRoute): string {
  const coordinates = route.waypoints
    .map((w) => `${w.lng.toFixed(7)},${w.lat.toFixed(7)},${w.altitudeMeters.toFixed(1)}`)
    .join(" ");
  const placemarks = route.waypoints
    .map(
      (waypoint, index) =>
        `    <Placemark><name>WP${index}</name><Point><altitudeMode>relativeToGround</altitudeMode>` +
        `<coordinates>${waypoint.lng.toFixed(7)},${waypoint.lat.toFixed(7)},${waypoint.altitudeMeters.toFixed(1)}</coordinates>` +
        `</Point></Placemark>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(route.name)}</name>
    <description>${escapeXml(route.description)}</description>
    <Placemark>
      <name>${escapeXml(route.name)} path</name>
      <LineString>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${coordinates}</coordinates>
      </LineString>
    </Placemark>
${placemarks}
  </Document>
</kml>`;
}

export function renderExport(route: ExportableRoute, format: ExportFormat): string {
  switch (format) {
    case "geojson":
      return toGeoJson(route);
    case "csv":
      return toWaypointCsv(route);
    case "kml":
      return toKml(route);
  }
}

const MIME_TYPES: Record<ExportFormat, string> = {
  geojson: "application/geo+json",
  csv: "text/csv",
  kml: "application/vnd.google-earth.kml+xml",
};

const EXTENSIONS: Record<ExportFormat, string> = {
  geojson: "geojson",
  csv: "csv",
  kml: "kml",
};

export function downloadRoute(route: ExportableRoute, format: ExportFormat): void {
  const blob = new Blob([renderExport(route, format)], { type: MIME_TYPES[format] });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(route.name)}.${EXTENSIONS[format]}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "route";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

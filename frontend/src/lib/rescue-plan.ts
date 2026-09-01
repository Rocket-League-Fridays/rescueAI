import type { IncidentDetail } from "@/types/incident";
import type {
  GeoPoint,
  JobDetail,
  LandingZone,
  LandingZoneCriterion,
  Route,
  RouteLeg,
} from "@/types/telemetry";

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

const CRITERION_WARNING: Record<LandingZoneCriterion, string> = {
  slope: "SLOPE UNCHECKED",
  footprint: "FOOTPRINT UNCHECKED",
  reachability: "REACHABILITY UNCHECKED",
  canopy: "CANOPY UNCHECKED",
  approach_clearance: "APPROACH UNCHECKED",
};

export interface MoveLeg {
  label: string;
  cardinal: string;
  distanceMeters: number;
  estimatedMinutes: number;
}

export interface RescuePlan {
  subjectName: string;
  inboundMinutes: number;
  outboundMinutes: number;
  totalMinutes: number;
  insert: {
    hasPad: boolean;
    coords: GeoPoint | null;
    slopeDegrees: number | null;
    approachBearings: number[];
    alternateCount: number;
    zone: LandingZone | null;
    alternates: LandingZone[];
  };
  move: {
    legs: MoveLeg[];
    totalAscentMeters: number;
  };
  subject: {
    coords: GeoPoint | null;
    clothingColors: string[];
    canopyFraction: number | null;
    clothingMatchPercent: number | null;
  };
  extract: {
    distanceMeters: number;
    estimatedMinutes: number;
  };
  warnings: string[];
  route: Route;
  landingZones: LandingZone[];
}

export function bearingDegrees(from: GeoPoint, to: GeoPoint): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function cardinalName(degrees: number): string {
  const index = Math.round(degrees / 45) % 8;
  return CARDINALS[index];
}

export function buildRescuePlan(
  job: JobDetail | null,
  incident: IncidentDetail | null,
): RescuePlan | null {
  const route = job?.route ?? null;
  if (!route || route.waypoints.length === 0) {
    return null;
  }

  const landingZones = [...(job?.landingZones ?? [])].sort(
    (a, b) => b.suitabilityScore - a.suitabilityScore,
  );
  const routed =
    landingZones.find((zone) => zone.id === route.landingZoneId) ?? landingZones[0] ?? null;
  const alternates = landingZones.filter((zone) => zone.id !== routed?.id);

  const inboundMinutes = route.inboundMinutes;
  const outboundMinutes = route.estimatedMinutes;
  const subjectName = incident?.subject.displayName || "Subject";
  const people = (job?.detections ?? []).filter((detection) => detection.className === "person");
  const best = people.reduce<(typeof people)[number] | undefined>(
    (winner, current) =>
      !winner || (current.clothingMatchScore ?? 0) > (winner.clothingMatchScore ?? 0)
        ? current
        : winner,
    undefined,
  );
  const subjectPoint =
    job?.situation?.groundPoint ?? best?.groundPoint ?? route.waypoints[0] ?? null;

  return {
    subjectName,
    inboundMinutes,
    outboundMinutes,
    totalMinutes: inboundMinutes + outboundMinutes,
    insert: {
      hasPad: routed !== null,
      coords: routed?.centroid ?? null,
      slopeDegrees: routed?.maxSlopeDegrees ?? null,
      approachBearings: routed?.approachBearingsDegrees ?? [],
      alternateCount: alternates.length,
      zone: routed,
      alternates,
    },
    move: {
      legs: inboundLegs(route),
      totalAscentMeters: route.elevationGainMeters,
    },
    subject: {
      coords: subjectPoint,
      clothingColors: incident?.subject.clothingColors ?? [],
      canopyFraction: job?.situation?.canopyFraction ?? null,
      clothingMatchPercent:
        best?.clothingMatchScore === undefined
          ? null
          : Math.round(best.clothingMatchScore * 100),
    },
    extract: {
      distanceMeters: route.distanceMeters,
      estimatedMinutes: outboundMinutes,
    },
    warnings: warningsFrom(routed),
    route,
    landingZones,
  };
}

export function buildRadioBrief(plan: RescuePlan): string {
  const lines = [
    `GAME PLAN — ${plan.subjectName.toUpperCase()}`,
    plan.insert.hasPad && plan.insert.coords
      ? `INSERT: ${formatPoint(plan.insert.coords)} slope ${plan.insert.slopeDegrees?.toFixed(1) ?? "—"}° approach ${
          plan.insert.approachBearings.length > 0
            ? plan.insert.approachBearings.map((bearing) => `${Math.round(bearing)}°`).join(" / ")
            : "none"
        }`
      : "INSERT: no candidate pads — insert on foot",
    `MOVE IN: ~${Math.round(plan.inboundMinutes)} min` +
      (plan.move.legs.length > 0
        ? ` (${plan.move.legs.map((leg) => `head ${leg.cardinal} ${Math.round(leg.distanceMeters)} m`).join("; ")})`
        : ""),
    plan.subject.coords
      ? `SUBJECT: ${formatPoint(plan.subject.coords)} clothing ${
          plan.subject.clothingColors.join(", ") || "not recorded"
        }${
          plan.subject.canopyFraction === null
            ? ""
            : ` canopy ${Math.round(plan.subject.canopyFraction * 100)}%`
        }`
      : "SUBJECT: no fix",
    `EXTRACT: ${Math.round(plan.extract.distanceMeters)} m ~${Math.round(plan.extract.estimatedMinutes)} min loaded`,
  ];
  if (plan.warnings.length > 0) {
    lines.push(`WARNINGS: ${plan.warnings.join(", ")}`);
  }
  return lines.join("\n");
}

function inboundLegs(route: Route): MoveLeg[] {
  return [...route.legs].reverse().map((leg) => {
    const from = route.waypoints[leg.endIndex];
    const to = route.waypoints[leg.startIndex];
    const bearing =
      from && to ? bearingDegrees({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }) : 0;
    return {
      label: inboundLabel(leg),
      cardinal: from && to ? cardinalName(bearing) : "—",
      distanceMeters: leg.distanceMeters,
      estimatedMinutes: inboundLegMinutes(leg, route),
    };
  });
}

function inboundLegMinutes(leg: RouteLeg, route: Route): number {
  if (route.estimatedMinutes <= 0) {
    return route.inboundMinutes;
  }
  return (leg.estimatedMinutes / route.estimatedMinutes) * route.inboundMinutes;
}

function inboundLabel(leg: RouteLeg): string {
  const label = leg.label.trim();
  const match = label.match(/^(.+?)\s+to\s+(.+)$/i);
  if (match) {
    return `${match[2]} to ${match[1]}`;
  }
  return label || "Walk inbound";
}

function warningsFrom(zone: LandingZone | null): string[] {
  if (!zone) {
    return [];
  }
  return zone.unassessedCriteria.map((criterion) => CRITERION_WARNING[criterion]);
}

function formatPoint(point: GeoPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

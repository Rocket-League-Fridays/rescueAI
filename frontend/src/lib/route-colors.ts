import type { RouteLegKind } from "@/types/telemetry";

export const ROUTE_LEG_COLORS: Record<RouteLegKind, string> = {
  subject_link: "#ff6b4a",
  off_trail: "#f0c14b",
  on_trail: "#c4d67c",
};

export const ROUTE_LEG_LABELS: Record<RouteLegKind, string> = {
  subject_link: "Subject link",
  off_trail: "Off trail",
  on_trail: "On trail",
};

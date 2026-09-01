import type { SearchLegKind } from "@/types/search";
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

/** Search-route hues, kept here beside the rescue hues so map, panel, and table never disagree. */
export const SEARCH_LEG_COLORS: Record<SearchLegKind, string> = {
  transit: "#7aa2f7",
  transect: "#4fd1c5",
  turn: "#3d6b8a",
};

export const SEARCH_LEG_LABELS: Record<SearchLegKind, string> = {
  transit: "Transit",
  transect: "Transect",
  turn: "Turn",
};

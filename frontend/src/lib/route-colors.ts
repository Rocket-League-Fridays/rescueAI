import type { SearchLegKind } from "@/types/search";
import type { RouteLegKind } from "@/types/telemetry";

/** Ordered by how hard the leg is to walk: green is the easy trail, orange is the final push. */
export const ROUTE_LEG_COLORS: Record<RouteLegKind, string> = {
  subject_link: "#FF4D36",
  off_trail: "#FFB020",
  on_trail: "#3DDC97",
};

export const ROUTE_LEG_LABELS: Record<RouteLegKind, string> = {
  subject_link: "Subject link",
  off_trail: "Off trail",
  on_trail: "On trail",
};

/** Search-route hues, kept here beside the rescue hues so map, panel, and table never disagree. */
export const SEARCH_LEG_COLORS: Record<SearchLegKind, string> = {
  transit: "#5C6E80",
  transect: "#3DD6F5",
  turn: "#2A6E80",
};

export const SEARCH_LEG_LABELS: Record<SearchLegKind, string> = {
  transit: "Transit",
  transect: "Transect",
  turn: "Turn",
};

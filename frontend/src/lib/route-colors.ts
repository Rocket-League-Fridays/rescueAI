import type { SearchLegKind } from "@/types/search";
import type { RouteLegKind } from "@/types/telemetry";

/** Ordered by how hard the leg is to walk: green is the easy trail, orange is the final push. */
export const ROUTE_LEG_COLORS: Record<RouteLegKind, string> = {
  subject_link: "#ff7a45",
  off_trail: "#ffb020",
  on_trail: "#3ddc97",
};

export const ROUTE_LEG_LABELS: Record<RouteLegKind, string> = {
  subject_link: "Subject link",
  off_trail: "Off trail",
  on_trail: "On trail",
};

/** Search-route hues, kept here beside the rescue hues so map, panel, and table never disagree. */
export const SEARCH_LEG_COLORS: Record<SearchLegKind, string> = {
  transit: "#7aa2f7",
  transect: "#38bdf8",
  turn: "#4a6b85",
};

export const SEARCH_LEG_LABELS: Record<SearchLegKind, string> = {
  transit: "Transit",
  transect: "Transect",
  turn: "Turn",
};

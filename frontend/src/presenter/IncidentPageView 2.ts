import type { DataOrigin, Staleness } from "@/lib/incident-snapshot";
import type { IncidentOverrides, ResolvedLastKnown } from "@/lib/incident-overrides";
import type { IncidentDetail } from "@/types/incident";
import type { SearchRoute } from "@/types/search";
import type { JobDetail } from "@/types/telemetry";

/** One coherent frame of incident state, with the operator's overrides already applied. */
export interface PresentedIncident {
  incident: IncidentDetail;
  job: JobDetail | null;
  searchRoute: SearchRoute | null;
  origin: DataOrigin;
  overrides: IncidentOverrides;
  lastKnown: ResolvedLastKnown;
}

/** Callbacks every incident-backed page needs. Locate and Rescue each extend this. */
export interface IncidentPageView {
  setIsLoading(loading: boolean): void;
  displayErrorMessage(message: string): void;
  clearErrorMessage(): void;
  displayIncident(presented: PresentedIncident): void;
  displayStaleness(staleness: Staleness | null): void;
  /** Nothing cached and the fetch failed — render an empty state, never a blank page. */
  displayUnavailable(message: string): void;
}

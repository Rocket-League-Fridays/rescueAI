import type { IncidentPageView } from "@/presenter/IncidentPageView";
import type { SearchRoute } from "@/types/search";

export interface LocateView extends IncidentPageView {
  displayTranscriptDraft(transcript: string): void;
  /** The planner endpoint is not wired yet — say so plainly instead of raising an error. */
  displayPlannerUnavailable(message: string): void;
  setIsPlanning(planning: boolean): void;
  displaySearchRoute(route: SearchRoute): void;
  navigateToLocate(incidentId: string): void;
  navigateToRescue(incidentId: string): void;
}

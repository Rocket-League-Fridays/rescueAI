import type { IncidentPageView } from "@/presenter/IncidentPageView";

export interface RescueView extends IncidentPageView {
  navigateToLocate(incidentId: string): void;
}

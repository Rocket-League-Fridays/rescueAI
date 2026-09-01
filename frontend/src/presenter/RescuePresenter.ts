import { IncidentPagePresenter } from "@/presenter/IncidentPagePresenter";
import type { RescueView } from "@/presenter/RescueView";

/**
 * The Rescue page is read-only: it renders what the search already found. All of its behaviour —
 * cache-first hydrate, never-blank refresh, override application — is the shared skeleton.
 */
export class RescuePresenter extends IncidentPagePresenter<RescueView> {
  goToLocate(incidentId: string): void {
    this.view.navigateToLocate(incidentId);
  }
}

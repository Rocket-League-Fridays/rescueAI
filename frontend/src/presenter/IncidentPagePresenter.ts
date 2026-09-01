import { ApiClientError } from "@/lib/api-client";
import {
  applyOverrides,
  resolveLastKnown,
  type IncidentOverrides,
  type OverrideStore,
} from "@/lib/incident-overrides";
import type { IncidentSnapshot, SnapshotStore } from "@/lib/incident-snapshot";
import type { IncidentSource } from "@/lib/incident-source";
import type { IncidentPageView } from "@/presenter/IncidentPageView";

/**
 * Shared load/refresh skeleton for both incident pages.
 *
 * The invariant this class exists to hold: once something has been shown, a later failure never
 * takes it away. A refresh that 404s or hits a dead backend re-presents the last good snapshot
 * and reports staleness instead of clearing state.
 */
export abstract class IncidentPagePresenter<V extends IncidentPageView> {
  protected snapshot: IncidentSnapshot | null = null;

  constructor(
    protected readonly view: V,
    protected readonly incidents: IncidentSource,
    protected readonly snapshots: SnapshotStore,
    protected readonly overrides: OverrideStore,
  ) {}

  /** Paint from cache first so a reload never flashes empty, then revalidate. */
  async hydrate(incidentId: string): Promise<void> {
    const cached = this.snapshots.read(incidentId);
    if (cached) {
      this.snapshot = cached;
      this.present(cached);
    }
    await this.refresh(incidentId);
  }

  async refresh(incidentId: string): Promise<void> {
    this.view.setIsLoading(true);
    try {
      const fresh = await this.incidents.load(incidentId);
      if (fresh.origin === "live") {
        this.snapshots.write(fresh);
      }
      this.snapshot = fresh;
      this.present(fresh);
      this.view.displayStaleness(null);
      this.view.clearErrorMessage();
    } catch (error) {
      const fallback = this.snapshot ?? this.snapshots.read(incidentId);
      if (fallback === null) {
        this.view.displayUnavailable(toErrorMessage(error, "Cannot reach this incident"));
        return;
      }
      this.snapshot = fallback;
      this.present(fallback);
      this.view.displayStaleness({
        fetchedAt: fallback.fetchedAt,
        reason: describeFailure(error),
        status: error instanceof ApiClientError ? error.status : null,
      });
    } finally {
      this.view.setIsLoading(false);
    }
  }

  readOverrides(incidentId: string): IncidentOverrides {
    return this.overrides.read(incidentId);
  }

  saveOverrides(incidentId: string, next: IncidentOverrides): void {
    this.overrides.write(incidentId, next);
    if (this.snapshot) {
      this.present(this.snapshot);
    }
  }

  protected present(snapshot: IncidentSnapshot): void {
    const overrides = this.overrides.read(snapshot.incident.id);
    const incident = applyOverrides(snapshot.incident, overrides);
    this.view.displayIncident({
      incident,
      job: snapshot.job,
      searchRoute: snapshot.searchRoute,
      origin: snapshot.origin,
      overrides,
      lastKnown: resolveLastKnown(incident, overrides),
    });
  }

  protected async doFailureReportingOperation(
    operation: () => Promise<void>,
    failurePrefix: string,
  ): Promise<void> {
    this.view.setIsLoading(true);
    this.view.clearErrorMessage();
    try {
      await operation();
    } catch (error) {
      this.view.displayErrorMessage(toErrorMessage(error, failurePrefix));
    } finally {
      this.view.setIsLoading(false);
    }
  }
}

export function toErrorMessage(error: unknown, prefix: string): string {
  if (error instanceof Error) {
    return `${prefix}: ${error.message}`;
  }
  return `${prefix}: unknown error`;
}

function describeFailure(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.status === 404
      ? "Incident not found on the server"
      : `Server returned ${error.status}`;
  }
  return "Backend unreachable";
}

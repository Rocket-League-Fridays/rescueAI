import { ApiClientError, type ApiClient } from "@/lib/api-client";
import type { OverrideStore } from "@/lib/incident-overrides";
import type { SnapshotStore } from "@/lib/incident-snapshot";
import {
  FIXTURE_INCIDENT_ID,
  isFixtureIncidentId,
  NO_INCIDENT_ID,
  type IncidentSource,
} from "@/lib/incident-source";
import type { RecentIncidentStore } from "@/lib/recent-incident";
import type { SearchRouteSource } from "@/lib/search-route-source";
import { sortieRequest } from "@/lib/sortie-request";
import { IncidentPagePresenter, toErrorMessage } from "@/presenter/IncidentPagePresenter";
import type { LocateView } from "@/presenter/LocateView";
import type { LastKnownPosition, SearchPatternKind, SearchPlanRequest } from "@/types/search";

const SCAN_POLL_MS = 2500;
const SCAN_POLL_LIMIT = 80;

export interface SearchParameters {
  patternKind: SearchPatternKind;
  altitudeAglMeters: number;
  overlapPercent: number;
}

/**
 * Drives the Locate beat: transcript in, corridor and subject reviewed, search route planned and
 * exported, scan monitored until it returns a fix.
 */
export class LocatePresenter extends IncidentPagePresenter<LocateView> {
  private scanPollToken = 0;

  constructor(
    view: LocateView,
    incidents: IncidentSource,
    snapshots: SnapshotStore,
    overrides: OverrideStore,
    private readonly apiClient: ApiClient,
    private readonly liveSearchRoutes: SearchRouteSource,
    private readonly fixtureSearchRoutes: SearchRouteSource,
    private readonly recentIncidents: RecentIncidentStore,
  ) {
    super(view, incidents, snapshots, overrides);
  }

  async transcribeAudio(file: File): Promise<void> {
    await this.doFailureReportingOperation(async () => {
      const result = await this.apiClient.transcribeAudio(file);
      this.view.displayTranscriptDraft(result.transcript);
    }, "Failed to transcribe audio");
  }

  async openIncident(transcript: string): Promise<void> {
    await this.doFailureReportingOperation(async () => {
      const created = await this.apiClient.createIncident({ transcript });
      await this.adoptIncident(created.id);
    }, "Failed to open incident");
  }

  async openDemoIncident(): Promise<void> {
    await this.doFailureReportingOperation(async () => {
      const created = await this.apiClient.createDemoIncident();
      await this.adoptIncident(created.id);
    }, "Failed to open demo incident");
  }

  /** No network at all — the committed fixture is served from its reserved id. */
  seedMockIncident(): void {
    this.view.clearErrorMessage();
    this.recentIncidents.write(FIXTURE_INCIDENT_ID);
    this.view.navigateToLocate(FIXTURE_INCIDENT_ID);
  }

  /**
   * Where the Rescue beat should go when the URL carries no incident, as on the intake landing:
   * the one this tab last worked, and otherwise the "no incident" placeholder — never the fixture,
   * or the beat would silently show demo data before any real incident exists.
   */
  rescueTargetIncidentId(): string {
    return this.recentIncidents.read() ?? NO_INCIDENT_ID;
  }

  /** Called by the page once an incident id is known, so the landing can offer it again later. */
  rememberIncident(incidentId: string): void {
    this.recentIncidents.write(incidentId);
  }

  /**
   * Called when the intake landing mounts with no incident in the URL — the operator followed
   * "New incident" or the title, so the Rescue tab must stop pointing at whatever was last open.
   */
  forgetRecentIncident(): void {
    this.recentIncidents.clear();
  }

  updateLastKnown(incidentId: string, position: LastKnownPosition): void {
    this.saveOverrides(incidentId, {
      ...this.readOverrides(incidentId),
      lastKnownPoint: position.point,
      lastKnownRadiusMeters: position.radiusMeters,
    });
  }

  async planSearchRoute(
    incidentId: string,
    lastKnown: LastKnownPosition,
    parameters: SearchParameters,
  ): Promise<void> {
    const request: SearchPlanRequest = {
      incidentId,
      lastKnown,
      ...parameters,
      trailLine: this.snapshot?.incident.trailLine,
      corridorBufferMeters: this.snapshot?.incident.corridorBufferMeters,
      boxCenter: this.snapshot?.incident.likelyLocations?.[0]?.point ?? lastKnown.point,
    };
    const preferLive = !isFixtureIncidentId(incidentId);

    this.view.setIsPlanning(true);
    this.view.clearErrorMessage();
    try {
      let route;
      try {
        route = preferLive
          ? await this.liveSearchRoutes.plan(request)
          : await this.fixtureSearchRoutes.plan(request);
      } catch (error) {
        if (preferLive && isMissingEndpoint(error)) {
          route = await this.fixtureSearchRoutes.plan(request);
        } else {
          throw error;
        }
      }
      if (this.snapshot) {
        this.snapshot = { ...this.snapshot, searchRoute: route };
        this.present(this.snapshot);
      }
      this.view.displaySearchRoute(route);
    } catch (error) {
      this.view.displayErrorMessage(toErrorMessage(error, "Failed to plan search route"));
    } finally {
      this.view.setIsPlanning(false);
    }
  }

  async attachSortie(
    incidentId: string,
    video: File | undefined,
    lastKnown: LastKnownPosition,
    altitudeAglMeters: number,
  ): Promise<void> {
    await this.doFailureReportingOperation(async () => {
      const request = sortieRequest(this.snapshot?.incident ?? null, lastKnown, altitudeAglMeters);
      const created =
        video === undefined
          ? await this.apiClient.createJob(request)
          : await this.apiClient.createJobWithVideo(request, video);
      await this.refresh(incidentId);
      void this.pollScanUntilTerminal(incidentId, created.id);
    }, "Failed to attach sortie");
  }

  /**
   * The scan is a background job, so the page polls instead of waiting. Terminates on a terminal
   * job status, on a bounded attempt count, or when the view calls `stopScanPolling`.
   */
  async pollScanUntilTerminal(incidentId: string, jobId: string): Promise<void> {
    const token = ++this.scanPollToken;
    for (let attempt = 0; attempt < SCAN_POLL_LIMIT; attempt += 1) {
      await delay(SCAN_POLL_MS);
      if (token !== this.scanPollToken) {
        return;
      }
      try {
        const job = await this.apiClient.getJob(jobId);
        if (this.snapshot) {
          this.snapshot = { ...this.snapshot, job };
          this.present(this.snapshot);
        }
        if (job.status === "completed" || job.status === "failed") {
          await this.refresh(incidentId);
          return;
        }
      } catch {
        return;
      }
    }
  }

  stopScanPolling(): void {
    this.scanPollToken += 1;
  }

  goToRescue(incidentId: string): void {
    this.view.navigateToRescue(incidentId);
  }

  private async adoptIncident(incidentId: string): Promise<void> {
    const snapshot = await this.incidents.load(incidentId);
    this.snapshots.write(snapshot);
    this.recentIncidents.write(incidentId);
    this.snapshot = snapshot;
    this.present(snapshot);
    this.view.navigateToLocate(incidentId);
  }
}

/** A planner that does not exist yet looks like a 404/405 or a refused connection. */
function isMissingEndpoint(error: unknown): boolean {
  if (error instanceof ApiClientError) {
    return error.status === 404 || error.status === 405 || error.status === 501;
  }
  return true;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

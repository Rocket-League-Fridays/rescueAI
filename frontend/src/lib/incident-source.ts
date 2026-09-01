import { type ApiClient, createApiClient } from "@/lib/api-client";
import type { IncidentSnapshot } from "@/lib/incident-snapshot";
import { mockIncidentDetail, mockJobDetail, mockSearchRoute } from "@/lib/mock-data";
import type { SearchRouteSource } from "@/lib/search-route-source";
import { ApiSearchRouteSource } from "@/lib/search-route-source";

/**
 * Reserved incident id for the committed fixture. It is a word rather than the fixture's UUID so
 * the address bar itself says the data is not live, and so it can never collide with a real row.
 */
export const FIXTURE_INCIDENT_ID = "mock";

/**
 * Reserved id for "no incident chosen yet" — distinct from the fixture id so a dead Rescue link
 * from the intake landing renders empty placeholders instead of silently loading fixture data.
 */
export const NO_INCIDENT_ID = "none";

export function isFixtureIncidentId(incidentId: string): boolean {
  return incidentId === FIXTURE_INCIDENT_ID;
}

export interface IncidentSource {
  load(incidentId: string): Promise<IncidentSnapshot>;
}

export class ApiIncidentSource implements IncidentSource {
  constructor(
    private readonly apiClient: ApiClient,
    private readonly searchRoutes: SearchRouteSource,
  ) {}

  async load(incidentId: string): Promise<IncidentSnapshot> {
    const incident = await this.apiClient.getIncident(incidentId);
    const latestJob = incident.jobs[incident.jobs.length - 1];
    const job = latestJob ? await this.apiClient.getJob(latestJob.id) : null;
    return {
      incident,
      job,
      searchRoute: await this.loadSearchRoute(incidentId),
      origin: "live",
      fetchedAt: new Date().toISOString(),
    };
  }

  /** The planner endpoint may not exist yet; a missing search route is not a failed incident. */
  private async loadSearchRoute(incidentId: string) {
    try {
      return await this.searchRoutes.load(incidentId);
    } catch {
      return null;
    }
  }
}

export class FixtureIncidentSource implements IncidentSource {
  async load(): Promise<IncidentSnapshot> {
    return {
      incident: mockIncidentDetail,
      job: mockJobDetail,
      searchRoute: mockSearchRoute,
      origin: "fixture",
      fetchedAt: new Date().toISOString(),
    };
  }
}

/** Picks the fixture for the reserved id and the live API for everything else. */
export class RoutedIncidentSource implements IncidentSource {
  constructor(
    private readonly live: IncidentSource,
    private readonly fixture: IncidentSource,
  ) {}

  async load(incidentId: string): Promise<IncidentSnapshot> {
    const source = isFixtureIncidentId(incidentId) ? this.fixture : this.live;
    return source.load(incidentId);
  }
}

export function createIncidentSource(apiClient: ApiClient = createApiClient()): IncidentSource {
  return new RoutedIncidentSource(
    new ApiIncidentSource(apiClient, new ApiSearchRouteSource(apiClient)),
    new FixtureIncidentSource(),
  );
}

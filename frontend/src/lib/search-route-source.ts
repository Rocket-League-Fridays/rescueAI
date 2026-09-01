import { type ApiClient, createApiClient } from "@/lib/api-client";
import { planFixtureSearchRoute } from "@/lib/fixture-search-planner";
import type { SearchPlanRequest, SearchRoute } from "@/types/search";

/**
 * Where a search route comes from. Josh's planner lands behind `ApiSearchRouteSource`; until
 * then the fixture implementation keeps the Locate page renderable and exportable.
 */
export interface SearchRouteSource {
  plan(request: SearchPlanRequest): Promise<SearchRoute>;
  /** `null` when no route has been planned for this incident yet. */
  load(incidentId: string): Promise<SearchRoute | null>;
}

export class ApiSearchRouteSource implements SearchRouteSource {
  constructor(private readonly apiClient: ApiClient) {}

  async plan(request: SearchPlanRequest): Promise<SearchRoute> {
    return this.apiClient.planSearchRoute(request.incidentId, request);
  }

  async load(incidentId: string): Promise<SearchRoute | null> {
    return this.apiClient.getSearchRoute(incidentId);
  }
}

export class FixtureSearchRouteSource implements SearchRouteSource {
  async plan(request: SearchPlanRequest): Promise<SearchRoute> {
    return planFixtureSearchRoute(request);
  }

  async load(): Promise<SearchRoute | null> {
    return null;
  }
}

export function createSearchRouteSource(apiClient: ApiClient = createApiClient()): SearchRouteSource {
  return new ApiSearchRouteSource(apiClient);
}

export function createFixtureSearchRouteSource(): SearchRouteSource {
  return new FixtureSearchRouteSource();
}

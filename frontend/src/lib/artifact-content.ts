import { type ApiClient, createApiClient } from "@/lib/api-client";
import {
  FIXTURE_ANNOTATED_ARTIFACT_ID,
  FIXTURE_FRAME_ARTIFACT_ID,
  fixtureAnnotatedFrameDataUri,
  fixtureFrameDataUri,
} from "@/lib/fixture-frames";
import { mockJobDetail } from "@/lib/mock-data";

/** Resolves an artifact id to something an `<img>` can load. */
export interface ArtifactContentSource {
  urlFor(artifactId: string): string;
}

export class ApiArtifactContentSource implements ArtifactContentSource {
  constructor(private readonly apiClient: ApiClient) {}

  urlFor(artifactId: string): string {
    return this.apiClient.artifactContentUrl(artifactId);
  }
}

/** The fixture's frames are drawn in the browser, so they resolve without a backend. */
export class FixtureArtifactContentSource implements ArtifactContentSource {
  private readonly cache = new Map<string, string>();

  urlFor(artifactId: string): string {
    const cached = this.cache.get(artifactId);
    if (cached !== undefined) {
      return cached;
    }
    const drawn =
      artifactId === FIXTURE_ANNOTATED_ARTIFACT_ID
        ? fixtureAnnotatedFrameDataUri(mockJobDetail.detections)
        : fixtureFrameDataUri();
    this.cache.set(artifactId, drawn);
    return drawn;
  }

  handles(artifactId: string): boolean {
    return artifactId === FIXTURE_FRAME_ARTIFACT_ID || artifactId === FIXTURE_ANNOTATED_ARTIFACT_ID;
  }
}

/** Fixture ids are reserved words, so routing on the id alone can never shadow a real artifact. */
export class RoutedArtifactContentSource implements ArtifactContentSource {
  constructor(
    private readonly live: ArtifactContentSource,
    private readonly fixture: FixtureArtifactContentSource,
  ) {}

  urlFor(artifactId: string): string {
    return this.fixture.handles(artifactId)
      ? this.fixture.urlFor(artifactId)
      : this.live.urlFor(artifactId);
  }
}

export function createArtifactContentSource(
  apiClient: ApiClient = createApiClient(),
): ArtifactContentSource {
  return new RoutedArtifactContentSource(
    new ApiArtifactContentSource(apiClient),
    new FixtureArtifactContentSource(),
  );
}

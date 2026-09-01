import type { CreateIncidentRequest, FixtureTranscript, Incident, IncidentDetail } from "@/types/incident";
import type { SearchPlanRequest, SearchRoute } from "@/types/search";
import type { CreateJobRequest, Job, JobDetail } from "@/types/telemetry";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async createIncident(request: CreateIncidentRequest): Promise<Incident> {
    return this.request<Incident>("/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  async createDemoIncident(): Promise<Incident> {
    return this.request<Incident>("/incidents/demo", { method: "POST" });
  }

  async getFixtureTranscript(): Promise<FixtureTranscript> {
    return this.request<FixtureTranscript>("/incidents/fixture");
  }

  async transcribeAudio(audio: File): Promise<FixtureTranscript> {
    const formData = new FormData();
    formData.append("audio", audio);
    return this.request<FixtureTranscript>("/incidents/transcribe", {
      method: "POST",
      body: formData,
    });
  }

  async getActiveIncident(): Promise<IncidentDetail> {
    return this.request<IncidentDetail>("/incidents/active");
  }

  async getIncident(incidentId: string): Promise<IncidentDetail> {
    return this.request<IncidentDetail>(`/incidents/${incidentId}`);
  }

  async createJob(request: CreateJobRequest): Promise<Job> {
    return this.request<Job>("/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  async createJobWithVideo(request: CreateJobRequest, video: File): Promise<Job> {
    const formData = new FormData();
    formData.append("telemetry", JSON.stringify(request.telemetry));
    if (request.incidentId) {
      formData.append("incident_id", request.incidentId);
    }
    formData.append("video", video);
    return this.request<Job>("/telemetry/upload", {
      method: "POST",
      body: formData,
    });
  }

  async getJob(jobId: string): Promise<JobDetail> {
    return this.request<JobDetail>(`/jobs/${jobId}`);
  }

  artifactContentUrl(artifactId: string): string {
    return `${this.baseUrl}/artifacts/${encodeURIComponent(artifactId)}/content`;
  }

  /** Not implemented by the backend yet — see `docs/context/07-frontend-seams.md`. */
  async planSearchRoute(incidentId: string, request: SearchPlanRequest): Promise<SearchRoute> {
    return this.request<SearchRoute>(`/incidents/${incidentId}/search-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  /** Not implemented by the backend yet — see `docs/context/07-frontend-seams.md`. */
  async getSearchRoute(incidentId: string): Promise<SearchRoute> {
    return this.request<SearchRoute>(`/incidents/${incidentId}/search-route`);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new ApiClientError(`Failed to call ${path}: ${detail}`, response.status);
    }
    return (await response.json()) as T;
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (body.detail !== undefined) {
      return JSON.stringify(body.detail);
    }
  } catch {
    return response.statusText;
  }
  return response.statusText;
}

export function createApiClient(): ApiClient {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return new ApiClient(baseUrl);
}

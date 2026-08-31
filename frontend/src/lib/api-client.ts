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
    formData.append("video", video);
    return this.request<Job>("/telemetry/upload", {
      method: "POST",
      body: formData,
    });
  }

  async getJob(jobId: string): Promise<JobDetail> {
    return this.request<JobDetail>(`/jobs/${jobId}`);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new ApiClientError(
        `Failed to call ${path}: ${detail}`,
        response.status,
      );
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

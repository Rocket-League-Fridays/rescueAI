import type { ApiClient } from "@/lib/api-client";
import type { CreateJobRequest } from "@/types/telemetry";
import type { DashboardView } from "@/presenter/DashboardView";

export class DashboardPresenter {
  constructor(
    private readonly view: DashboardView,
    private readonly apiClient: ApiClient,
  ) {}

  async submitTelemetry(request: CreateJobRequest, video?: File): Promise<void> {
    this.view.setIsLoading(true);
    this.view.clearErrorMessage();
    try {
      const created =
        video === undefined
          ? await this.apiClient.createJob(request)
          : await this.apiClient.createJobWithVideo(request, video);
      const detail = await this.apiClient.getJob(created.id);
      this.view.displayJob(detail);
    } catch (error) {
      this.view.displayErrorMessage(toErrorMessage(error, "Failed to submit telemetry"));
    } finally {
      this.view.setIsLoading(false);
    }
  }

  async loadJob(jobId: string): Promise<void> {
    this.view.setIsLoading(true);
    this.view.clearErrorMessage();
    try {
      const detail = await this.apiClient.getJob(jobId);
      this.view.displayJob(detail);
    } catch (error) {
      this.view.displayErrorMessage(toErrorMessage(error, "Failed to load job"));
    } finally {
      this.view.setIsLoading(false);
    }
  }
}

function toErrorMessage(error: unknown, prefix: string): string {
  if (error instanceof Error) {
    return `${prefix}: ${error.message}`;
  }
  return `${prefix}: unknown error`;
}

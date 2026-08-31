import type { ApiClient } from "@/lib/api-client";
import type { CreateJobRequest } from "@/types/telemetry";
import type { DashboardView } from "@/presenter/DashboardView";

export class DashboardPresenter {
  constructor(
    private readonly view: DashboardView,
    private readonly apiClient: ApiClient,
  ) {}

  async loadFixtureTranscript(): Promise<void> {
    this.view.setIsLoading(true);
    this.view.clearErrorMessage();
    try {
      const fixture = await this.apiClient.getFixtureTranscript();
      this.view.displayTranscriptDraft(fixture.transcript);
    } catch (error) {
      this.view.displayErrorMessage(toErrorMessage(error, "Failed to load fixture transcript"));
    } finally {
      this.view.setIsLoading(false);
    }
  }

  async openIncident(transcript: string): Promise<void> {
    this.view.setIsLoading(true);
    this.view.clearErrorMessage();
    try {
      const created = await this.apiClient.createIncident({ transcript });
      const detail = await this.apiClient.getIncident(created.id);
      this.view.displayIncident(detail);
    } catch (error) {
      this.view.displayErrorMessage(toErrorMessage(error, "Failed to open incident"));
    } finally {
      this.view.setIsLoading(false);
    }
  }

  async openDemoIncident(): Promise<void> {
    this.view.setIsLoading(true);
    this.view.clearErrorMessage();
    try {
      const created = await this.apiClient.createDemoIncident();
      const detail = await this.apiClient.getIncident(created.id);
      this.view.displayIncident(detail);
    } catch (error) {
      this.view.displayErrorMessage(toErrorMessage(error, "Failed to open demo incident"));
    } finally {
      this.view.setIsLoading(false);
    }
  }

  async refreshIncident(incidentId: string): Promise<void> {
    this.view.setIsLoading(true);
    this.view.clearErrorMessage();
    try {
      const detail = await this.apiClient.getIncident(incidentId);
      this.view.displayIncident(detail);
      const latestJob = detail.jobs[detail.jobs.length - 1];
      if (latestJob) {
        const job = await this.apiClient.getJob(latestJob.id);
        this.view.displayJob(job);
      }
    } catch (error) {
      this.view.displayErrorMessage(toErrorMessage(error, "Failed to refresh incident"));
    } finally {
      this.view.setIsLoading(false);
    }
  }

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
      this.view.displayErrorMessage(toErrorMessage(error, "Failed to submit sortie"));
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

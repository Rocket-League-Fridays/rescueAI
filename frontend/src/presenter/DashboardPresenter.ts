import { ApiClientError, type ApiClient } from "@/lib/api-client";
import type { CreateJobRequest } from "@/types/telemetry";
import type { DashboardView } from "@/presenter/DashboardView";

export class DashboardPresenter {
  constructor(
    private readonly view: DashboardView,
    private readonly apiClient: ApiClient,
  ) {}

  async resumeActiveIncident(): Promise<void> {
    try {
      const detail = await this.apiClient.getActiveIncident();
      this.view.displayIncident(detail);
      const latestJob = detail.jobs[detail.jobs.length - 1];
      if (latestJob) {
        await this.waitForJob(latestJob.id);
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        return;
      }
      this.view.displayErrorMessage(
        toErrorMessage(error, "Failed to resume active incident"),
      );
    }
  }

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
        await this.waitForJob(latestJob.id);
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
      await this.waitForJob(created.id);
    } catch (error) {
      this.view.displayErrorMessage(toErrorMessage(error, "Failed to submit sortie"));
    } finally {
      this.view.setIsLoading(false);
    }
  }

  private async waitForJob(jobId: string): Promise<void> {
    const maxPolls = 80;
    for (let poll = 0; poll < maxPolls; poll += 1) {
      const detail = await this.apiClient.getJob(jobId);
      this.view.displayJob(detail);
      if (detail.status === "completed") {
        return;
      }
      if (detail.status === "failed") {
        throw new Error(detail.failureReason ?? `Job ${jobId} failed`);
      }
      await delay(1500);
    }
    throw new Error(`Job ${jobId} did not finish within two minutes`);
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

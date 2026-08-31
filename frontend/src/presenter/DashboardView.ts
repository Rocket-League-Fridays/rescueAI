import type { IncidentDetail } from "@/types/incident";
import type { JobDetail } from "@/types/telemetry";

export interface DashboardView {
  setIsLoading(loading: boolean): void;
  displayErrorMessage(message: string): void;
  clearErrorMessage(): void;
  displayIncident(incident: IncidentDetail): void;
  displayJob(job: JobDetail): void;
  displayTranscriptDraft(transcript: string): void;
}

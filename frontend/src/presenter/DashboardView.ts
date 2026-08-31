import type { JobDetail } from "@/types/telemetry";

export interface DashboardView {
  setIsLoading(loading: boolean): void;
  displayErrorMessage(message: string): void;
  clearErrorMessage(): void;
  displayJob(job: JobDetail): void;
}

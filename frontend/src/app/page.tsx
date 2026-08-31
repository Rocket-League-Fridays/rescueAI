"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

import { StreamViewer } from "@/components/StreamViewer";
import { TacticalMap } from "@/components/TacticalMap";
import { createApiClient } from "@/lib/api-client";
import { DashboardPresenter } from "@/presenter/DashboardPresenter";
import type { DashboardView } from "@/presenter/DashboardView";
import type { CreateJobRequest, Detection, JobDetail } from "@/types/telemetry";

const SAMPLE_TELEMETRY: CreateJobRequest = {
  telemetry: {
    position: { lat: 40.2338, lng: -111.6585 },
    bounds: {
      southWest: { lat: 40.22, lng: -111.68 },
      northEast: { lat: 40.25, lng: -111.63 },
    },
    altitudeMeters: 420,
    headingDegrees: 135,
    gimbal: { pitchDegrees: -45, yawDegrees: 0, rollDegrees: 0 },
    timestampUtc: new Date().toISOString(),
    speedMps: 12,
    batteryPercent: 78,
  },
};

export default function CommandDashboardPage() {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobIdInput, setJobIdInput] = useState("");
  const videoInputRef = useRef<HTMLInputElement>(null);

  const presenter = useMemo(() => {
    const view: DashboardView = {
      setIsLoading,
      displayErrorMessage: setErrorMessage,
      clearErrorMessage: () => setErrorMessage(null),
      displayJob: (nextJob) => {
        setJob(nextJob);
        setJobIdInput(nextJob.id);
      },
    };
    return new DashboardPresenter(view, createApiClient());
  }, []);

  const personAlerts = (job?.detections ?? []).filter(
    (detection) => detection.className === "person",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const video = videoInputRef.current?.files?.[0];
    await presenter.submitTelemetry(SAMPLE_TELEMETRY, video);
  }

  async function handleRefresh() {
    if (!jobIdInput.trim()) {
      setErrorMessage("Failed to load job: enter a job id");
      return;
    }
    await presenter.loadJob(jobIdInput.trim());
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-olive-800 bg-tactical-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-olive-400">
              RescueAI · SAR
            </p>
            <h1 className="text-lg font-semibold text-olive-50">Command dashboard</h1>
          </div>
          <StatusBadge status={job?.status ?? "idle"} />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <StreamViewer jobId={job?.id} hasVideo={Boolean(job?.videoArtifactId)} />
          <TacticalMap job={job} />
        </div>

        <aside className="space-y-4">
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-lg border border-olive-700 bg-tactical-900 p-4"
          >
            <h2 className="font-mono text-xs uppercase tracking-widest text-olive-300">
              Ingest
            </h2>
            <p className="text-sm text-olive-300">
              Submits sample Provo-area telemetry. Optional video is stored as an artifact;
              CV/GIS pipelines are stubs.
            </p>
            <label className="block font-mono text-[11px] uppercase text-olive-400">
              Video (optional)
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="mt-1 block w-full text-xs text-olive-200 file:mr-3 file:rounded file:border-0 file:bg-olive-800 file:px-2 file:py-1 file:text-olive-100"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded bg-amber-400 px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-tactical-950 disabled:opacity-50"
            >
              {isLoading ? "Processing…" : "Submit telemetry"}
            </button>
            <div className="flex gap-2">
              <input
                value={jobIdInput}
                onChange={(event) => setJobIdInput(event.target.value)}
                placeholder="Job id"
                className="w-full rounded border border-olive-700 bg-tactical-800 px-2 py-1 font-mono text-xs text-olive-100"
              />
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isLoading}
                className="rounded border border-olive-600 px-3 py-1 font-mono text-xs uppercase text-olive-200 disabled:opacity-50"
              >
                Load
              </button>
            </div>
          </form>

          {errorMessage ? (
            <div className="rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : null}

          {personAlerts.length > 0 ? (
            <PersonAlert detections={personAlerts} />
          ) : null}

          <JobPanel job={job} />
        </aside>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded border border-olive-700 bg-tactical-800 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-olive-200">
      {status}
    </span>
  );
}

function PersonAlert({ detections }: { detections: Detection[] }) {
  return (
    <div className="rounded-lg border border-amber-600 bg-amber-950/70 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
        CV alert
      </p>
      <p className="text-sm text-amber-100">
        Person detected ({detections.length} box{detections.length === 1 ? "" : "es"})
      </p>
    </div>
  );
}

function JobPanel({ job }: { job: JobDetail | null }) {
  if (!job) {
    return (
      <div className="rounded-lg border border-olive-800 bg-tactical-900 p-4 font-mono text-xs text-olive-500">
        No job loaded.
      </div>
    );
  }

  return (
    <dl className="space-y-2 rounded-lg border border-olive-700 bg-tactical-900 p-4 font-mono text-xs">
      <Row label="Job" value={job.id} />
      <Row label="Status" value={job.status} />
      <Row label="Failure" value={job.failureReason ?? "—"} />
      <Row label="Detections" value={String(job.detectionIds.length)} />
      <Row label="Landing zones" value={String(job.landingZoneIds.length)} />
      <Row label="Route" value={job.routeId ?? "—"} />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-widest text-olive-500">{label}</dt>
      <dd className="break-all text-olive-100">{value}</dd>
    </div>
  );
}

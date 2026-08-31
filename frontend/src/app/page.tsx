"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

import { StreamViewer } from "@/components/StreamViewer";
import { TacticalMap } from "@/components/TacticalMap";
import { createApiClient } from "@/lib/api-client";
import { DashboardPresenter } from "@/presenter/DashboardPresenter";
import type { DashboardView } from "@/presenter/DashboardView";
import type { IncidentDetail } from "@/types/incident";
import type { CreateJobRequest, Detection, JobDetail } from "@/types/telemetry";

export default function CommandDashboardPage() {
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [transcript, setTranscript] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const presenter = useMemo(() => {
    const view: DashboardView = {
      setIsLoading,
      displayErrorMessage: setErrorMessage,
      clearErrorMessage: () => setErrorMessage(null),
      displayIncident: (next) => {
        setIncident(next);
        setTranscript(next.transcript);
      },
      displayJob: setJob,
      displayTranscriptDraft: setTranscript,
    };
    return new DashboardPresenter(view, createApiClient());
  }, []);

  const clothingAlerts = (job?.detections ?? []).filter(
    (detection) =>
      detection.className === "person" && (detection.clothingMatchScore ?? 0) >= 0.12,
  );

  async function handleOpenIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await presenter.openIncident(transcript);
  }

  async function handleAttachSortie(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const video = videoInputRef.current?.files?.[0];
    const request = sortieRequest(incident);
    await presenter.submitTelemetry(request, video);
    if (incident) {
      await presenter.refreshIncident(incident.id);
    }
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
          <StatusBadge status={incident?.status ?? job?.status ?? "idle"} />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <StreamViewer jobId={job?.id} hasVideo={Boolean(job?.videoArtifactId)} />
          <TacticalMap incident={incident} job={job} />
        </div>

        <aside className="space-y-4">
          <form
            onSubmit={handleOpenIncident}
            className="space-y-3 rounded-lg border border-olive-700 bg-tactical-900 p-4"
          >
            <h2 className="font-mono text-xs uppercase tracking-widest text-olive-300">
              1. Distress intake
            </h2>
            <textarea
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              rows={7}
              placeholder="Paste the 911 / Scout leader transcript"
              className="w-full rounded border border-olive-700 bg-tactical-800 px-2 py-2 text-sm text-olive-100"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => presenter.loadFixtureTranscript()}
                className="flex-1 rounded border border-olive-600 px-3 py-2 font-mono text-[10px] uppercase text-olive-200"
              >
                Load Josh / Y fixture
              </button>
              <button
                type="submit"
                disabled={isLoading || !transcript.trim()}
                className="flex-1 rounded bg-amber-400 px-3 py-2 font-mono text-[10px] font-semibold uppercase text-tactical-950 disabled:opacity-50"
              >
                Open incident
              </button>
            </div>
          </form>

          {incident ? <IncidentPanel incident={incident} /> : null}

          <form
            onSubmit={handleAttachSortie}
            className="space-y-3 rounded-lg border border-olive-700 bg-tactical-900 p-4"
          >
            <h2 className="font-mono text-xs uppercase tracking-widest text-olive-300">
              3. Attach Mini 4K sortie
            </h2>
            <p className="text-xs text-olive-400">
              Pre-recorded MP4 from the Y. Inbox drop also attaches to the open incident.
            </p>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="block w-full text-xs text-olive-200 file:mr-3 file:rounded file:border-0 file:bg-olive-800 file:px-2 file:py-1"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded border border-olive-600 px-3 py-2 font-mono text-[10px] uppercase text-olive-100 disabled:opacity-50"
            >
              Process video
            </button>
            {incident ? (
              <button
                type="button"
                onClick={() => presenter.refreshIncident(incident.id)}
                className="w-full font-mono text-[10px] uppercase text-olive-400"
              >
                Refresh after inbox drop
              </button>
            ) : null}
          </form>

          {errorMessage ? (
            <div className="rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : null}

          {clothingAlerts.length > 0 ? <PersonAlert detections={clothingAlerts} incident={incident} /> : null}

          {job?.situation ? (
            <div className="rounded-lg border border-olive-700 bg-tactical-900 p-4 font-mono text-xs">
              <p className="uppercase tracking-widest text-olive-400">Situation</p>
              <p className="mt-1 text-olive-100">
                {job.situation.groundPoint.lat.toFixed(5)}, {job.situation.groundPoint.lng.toFixed(5)}
              </p>
              <p className="text-olive-300">
                Canopy {(job.situation.canopyFraction * 100).toFixed(0)}%
              </p>
            </div>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

function sortieRequest(incident: IncidentDetail | null): CreateJobRequest {
  const start = incident?.trailLine[0] ?? { lat: 40.24555, lng: -111.62815 };
  return {
    incidentId: incident?.id,
    telemetry: {
      position: start,
      bounds: {
        southWest: { lat: start.lat - 0.01, lng: start.lng - 0.01 },
        northEast: { lat: start.lat + 0.01, lng: start.lng + 0.01 },
      },
      altitudeMeters: 120,
      headingDegrees: 45,
      gimbal: { pitchDegrees: -45, yawDegrees: 0, rollDegrees: 0 },
      timestampUtc: new Date().toISOString(),
    },
  };
}

function IncidentPanel({ incident }: { incident: IncidentDetail }) {
  return (
    <div className="space-y-2 rounded-lg border border-olive-700 bg-tactical-900 p-4 text-sm">
      <h2 className="font-mono text-xs uppercase tracking-widest text-olive-300">
        2. Search corridor
      </h2>
      <p className="text-olive-50">{incident.subject.displayName}</p>
      <p className="text-olive-300">{incident.trailName}</p>
      <p className="font-mono text-[11px] text-olive-400">
        Clothing: {incident.subject.clothingColors.join(", ") || "—"}
      </p>
      <p className="font-mono text-[11px] text-olive-500">
        Buffer {incident.corridorBufferMeters} m · {incident.jobs.length} sortie
        {incident.jobs.length === 1 ? "" : "s"}
      </p>
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

function PersonAlert({
  detections,
  incident,
}: {
  detections: Detection[];
  incident: IncidentDetail | null;
}) {
  const best = detections.reduce((winner, current) =>
    (current.clothingMatchScore ?? 0) > (winner.clothingMatchScore ?? 0) ? current : winner,
  );
  return (
    <div className="rounded-lg border border-amber-600 bg-amber-950/70 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
        Subject match
      </p>
      <p className="text-sm text-amber-100">
        {incident?.subject.displayName ?? "Person"} · clothing{" "}
        {((best.clothingMatchScore ?? 0) * 100).toFixed(0)}%
      </p>
    </div>
  );
}

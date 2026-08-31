"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
  const [sortieLat, setSortieLat] = useState("40.3885871");
  const [sortieLng, setSortieLng] = useState("-111.5447068");
  const [sortieAltitude, setSortieAltitude] = useState("40");
  const videoInputRef = useRef<HTMLInputElement>(null);

  const apiClient = useMemo(() => createApiClient(), []);
  const presenter = useMemo(() => {
    const view: DashboardView = {
      setIsLoading,
      displayErrorMessage: setErrorMessage,
      clearErrorMessage: () => setErrorMessage(null),
      displayIncident: (next) => {
        setIncident(next);
        setTranscript(next.transcript);
        const trailStart = next.trailLine[0];
        if (trailStart) {
          setSortieLat(String(trailStart.lat));
          setSortieLng(String(trailStart.lng));
        }
      },
      displayJob: setJob,
      displayTranscriptDraft: setTranscript,
    };
    return new DashboardPresenter(view, apiClient);
  }, [apiClient]);

  useEffect(() => {
    void presenter.resumeActiveIncident();
  }, [presenter]);

  const clothingAlerts = (job?.detections ?? []).filter(
    (detection) => detection.className === "person",
  );

  async function handleOpenIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await presenter.openIncident(transcript);
  }

  async function handleAttachSortie(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const video = videoInputRef.current?.files?.[0];
    const request = sortieRequest(
      incident,
      Number(sortieLat),
      Number(sortieLng),
      Number(sortieAltitude),
    );
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
          <StatusBadge status={job?.status ?? incident?.status ?? "idle"} />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <StreamViewer
            job={job}
            subjectName={incident?.subject.displayName}
            artifactContentUrl={(artifactId) => apiClient.artifactContentUrl(artifactId)}
          />
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
              Upload a recorded MP4/MOV and its approximate drone position. Analysis usually
              takes 30–60 seconds.
            </p>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="block w-full text-xs text-olive-200 file:mr-3 file:rounded file:border-0 file:bg-olive-800 file:px-2 file:py-1"
            />
            <div className="grid grid-cols-2 gap-2">
              <CoordinateInput
                label="Latitude"
                value={sortieLat}
                onChange={setSortieLat}
                step="0.0000001"
              />
              <CoordinateInput
                label="Longitude"
                value={sortieLng}
                onChange={setSortieLng}
                step="0.0000001"
              />
            </div>
            <CoordinateInput
              label="Drone height AGL (meters)"
              value={sortieAltitude}
              onChange={setSortieAltitude}
              step="1"
            />
            <button
              type="submit"
              disabled={
                isLoading ||
                !Number.isFinite(Number(sortieLat)) ||
                !Number.isFinite(Number(sortieLng)) ||
                Number(sortieAltitude) <= 0
              }
              className="w-full rounded bg-amber-400 px-3 py-2 font-mono text-[10px] font-semibold uppercase text-tactical-950 disabled:opacity-50"
            >
              {isLoading ? "Analyzing sortie…" : "Analyze video + locate subject"}
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

function sortieRequest(
  incident: IncidentDetail | null,
  lat: number,
  lng: number,
  altitudeMeters: number,
): CreateJobRequest {
  const start = { lat, lng };
  return {
    incidentId: incident?.id,
    telemetry: {
      position: start,
      bounds: {
        southWest: { lat: start.lat - 0.01, lng: start.lng - 0.01 },
        northEast: { lat: start.lat + 0.01, lng: start.lng + 0.01 },
      },
      altitudeMeters,
      headingDegrees: 0,
      gimbal: { pitchDegrees: -60, yawDegrees: 0, rollDegrees: 0 },
      timestampUtc: new Date().toISOString(),
    },
  };
}

function CoordinateInput({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  step: string;
}) {
  return (
    <label className="block font-mono text-[10px] uppercase tracking-wider text-olive-400">
      {label}
      <input
        type="number"
        required
        value={value}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border border-olive-700 bg-tactical-800 px-2 py-2 text-xs text-olive-100"
      />
    </label>
  );
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
        Subject located
      </p>
      <p className="text-sm text-amber-100">
        {incident?.subject.displayName ?? "Person"} · person{" "}
        {(best.confidence * 100).toFixed(0)}% · clothing{" "}
        {((best.clothingMatchScore ?? 0) * 100).toFixed(0)}%
      </p>
    </div>
  );
}

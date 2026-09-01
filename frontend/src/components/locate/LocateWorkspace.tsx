"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CommandSurface } from "@/components/CommandSurface";
import { IncidentStageNav } from "@/components/IncidentStageNav";
import { usePublishMission } from "@/components/MissionContext";
import { IncidentReport } from "@/components/locate/IncidentReport";
import { LastKnownForm } from "@/components/locate/LastKnownForm";
import { ScanMonitor } from "@/components/locate/ScanMonitor";
import { SearchParamsForm } from "@/components/locate/SearchParamsForm";
import { SearchRoutePanel } from "@/components/locate/SearchRoutePanel";
import { SortieForm } from "@/components/locate/SortieForm";
import { TacticalMap } from "@/components/TacticalMap";
import {
  buttonGhost,
  buttonPrimary,
  buttonSecondary,
  Corners,
  EmptyState,
  ErrorBanner,
  hudPanelClass,
  inputClass,
} from "@/components/ui";
import { createApiClient } from "@/lib/api-client";
import { createOverrideStore, type IncidentOverrides } from "@/lib/incident-overrides";
import { createSnapshotStore, type Staleness } from "@/lib/incident-snapshot";
import { createIncidentSource, FIXTURE_INCIDENT_ID } from "@/lib/incident-source";
import { createRecentIncidentStore } from "@/lib/recent-incident";
import {
  createFixtureSearchRouteSource,
  createSearchRouteSource,
} from "@/lib/search-route-source";
import { LocatePresenter, type SearchParameters } from "@/presenter/LocatePresenter";
import type { LocateView } from "@/presenter/LocateView";
import type { PresentedIncident } from "@/presenter/IncidentPageView";
import type { LastKnownPosition } from "@/types/search";
import type { GeoPoint } from "@/types/telemetry";

const RECOMMENDED_SEARCH: SearchParameters = {
  patternKind: "corridor_sweep",
  altitudeAglMeters: 120,
  overlapPercent: 70,
};

interface LocateWorkspaceProps {
  /** `null` on `/` — no incident has been opened yet. */
  incidentId: string | null;
}

export function LocateWorkspace({ incidentId }: LocateWorkspaceProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const [presented, setPresented] = useState<PresentedIncident | null>(null);
  const [transcript, setTranscript] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [plannerMessage, setPlannerMessage] = useState<string | null>(null);
  const [staleness, setStaleness] = useState<Staleness | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [rescueTarget, setRescueTarget] = useState(FIXTURE_INCIDENT_ID);
  const [searchParameters, setSearchParameters] = useState<SearchParameters>(RECOMMENDED_SEARCH);

  const presenter = useMemo(() => {
    const view: LocateView = {
      setIsLoading,
      setIsPlanning,
      displayErrorMessage: setErrorMessage,
      clearErrorMessage: () => setErrorMessage(null),
      displayIncident: (next) => {
        setPresented(next);
        setUnavailable(null);
        setTranscript((current) => (current.trim() === "" ? next.incident.transcript : current));
      },
      displayStaleness: setStaleness,
      displayUnavailable: setUnavailable,
      displayTranscriptDraft: setTranscript,
      displayPlannerUnavailable: setPlannerMessage,
      displaySearchRoute: () => setPlannerMessage(null),
      navigateToLocate: (id) => routerRef.current.push(`/locate/${id}`),
      navigateToRescue: (id) => routerRef.current.push(`/rescue/${id}`),
    };
    const apiClient = createApiClient();
    return new LocatePresenter(
      view,
      createIncidentSource(apiClient),
      createSnapshotStore(),
      createOverrideStore(),
      apiClient,
      createSearchRouteSource(apiClient),
      createFixtureSearchRouteSource(),
      createRecentIncidentStore(),
    );
  }, []);

  useEffect(() => {
    if (incidentId === null) {
      return;
    }
    presenter.rememberIncident(incidentId);
    void presenter.hydrate(incidentId);
    return () => presenter.stopScanPolling();
  }, [incidentId, presenter]);

  useEffect(() => {
    if (incidentId === null) {
      presenter.forgetRecentIncident();
      setRescueTarget(presenter.rescueTargetIncidentId());
    }
  }, [incidentId, presenter]);

  const onRefresh = useCallback(() => {
    if (incidentId) {
      void presenter.refresh(incidentId);
    }
  }, [incidentId, presenter]);

  usePublishMission({
    incidentId: incidentId ?? undefined,
    rescueReady: presented ? hasSubjectFix(presented) : undefined,
    jobStatus: presented?.job?.status ?? (incidentId ? null : undefined),
    onRefresh: incidentId ? onRefresh : undefined,
    isRefreshing: isLoading,
  });

  function handleOverridesChange(next: IncidentOverrides) {
    if (incidentId) {
      presenter.saveOverrides(incidentId, next);
    }
  }

  function handleLastKnownChange(position: LastKnownPosition) {
    if (incidentId) {
      presenter.updateLastKnown(incidentId, position);
    }
  }

  function handleLastKnownDragged(point: GeoPoint) {
    if (presented) {
      handleLastKnownChange({ ...presented.lastKnown.position, point });
    }
  }

  if (incidentId === null) {
    return (
      <IntakeLanding
        transcript={transcript}
        isLoading={isLoading}
        errorMessage={errorMessage}
        rescueTarget={rescueTarget}
        onTranscriptChange={setTranscript}
        onOpenIncident={() => void presenter.openIncident(transcript)}
        onSeedData={() => presenter.seedMockIncident()}
        onTranscribeAudio={(file) => presenter.transcribeAudio(file)}
      />
    );
  }

  if (unavailable !== null) {
    return (
      <UnavailableState
        message={unavailable}
        onRetry={() => void presenter.hydrate(incidentId)}
      />
    );
  }

  if (presented === null) {
    return (
      <div className="px-4 py-8">
        <EmptyState>Loading incident…</EmptyState>
      </div>
    );
  }

  const { incident, job, searchRoute, origin, overrides, lastKnown } = presented;

  return (
    <CommandSurface
      origin={origin}
      staleness={staleness}
      errorMessage={errorMessage}
      map={
        <TacticalMap
          incident={incident}
          job={job}
          focus="locate"
          lastKnown={lastKnown.position}
          searchRoute={searchRoute}
          onLastKnownDragged={handleLastKnownDragged}
          title="Search area"
          bleed
          headerAction={
            <button
              type="button"
              disabled={isPlanning}
              onClick={() =>
                void presenter.planSearchRoute(incidentId, lastKnown.position, searchParameters)
              }
              className={buttonPrimary}
            >
              {isPlanning ? "Planning…" : "Recommended rescue route"}
            </button>
          }
        />
      }
      left={
        <>
          <IncidentReport
            incident={incident}
            overrides={overrides}
            lastKnown={lastKnown.position}
            onChange={handleOverridesChange}
          />
          <LastKnownForm
            lastKnown={lastKnown.position}
            source={lastKnown.source}
            onChange={handleLastKnownChange}
            onRevert={() => {
              const next = { ...overrides };
              delete next.lastKnownPoint;
              delete next.lastKnownRadiusMeters;
              presenter.saveOverrides(incidentId, next);
            }}
          />
        </>
      }
      right={
        <>
          <SearchParamsForm
            parameters={searchParameters}
            isPlanning={isPlanning}
            disabled={false}
            onChange={setSearchParameters}
            onPlan={() =>
              void presenter.planSearchRoute(incidentId, lastKnown.position, searchParameters)
            }
          />
          <SortieForm
            isLoading={isLoading}
            disabled={origin === "fixture"}
            onAttach={(video) =>
              void presenter.attachSortie(
                incidentId,
                video,
                lastKnown.position,
                searchParameters.altitudeAglMeters,
              )
            }
            onRefresh={() => void presenter.refresh(incidentId)}
          />
          <ScanMonitor
            job={job}
            incident={incident}
            onGoToRescue={() => presenter.goToRescue(incidentId)}
          />
          <SearchRoutePanel
            route={searchRoute}
            incidentLabel={incident.subject.displayName || "incident"}
            plannerMessage={plannerMessage}
          />
        </>
      }
    />
  );
}

function IntakeLanding({
  transcript,
  isLoading,
  errorMessage,
  rescueTarget,
  onTranscriptChange,
  onOpenIncident,
  onSeedData,
  onTranscribeAudio,
}: {
  transcript: string;
  isLoading: boolean;
  errorMessage: string | null;
  rescueTarget: string;
  onTranscriptChange(value: string): void;
  onOpenIncident(): void;
  onSeedData(): void;
  onTranscribeAudio(file: File): Promise<void>;
}) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const busy = isLoading || isTranscribing;

  return (
    <div className="flex min-h-[calc(100vh-44px)] flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 animate-boot-in">
        <IncidentStageNav incidentId={rescueTarget} stage="locate" locateHref="/" />
      </div>

      <Corners className="w-full max-w-[720px] animate-boot-in" colorClass="text-signal">
        <section className={`${hudPanelClass} p-6`}>
          <h1 className="text-2xl font-semibold uppercase tracking-[0.18em] text-ink-50">
            Initiate search
            <span className="ml-1 inline-block animate-blink text-signal" aria-hidden>
              ▍
            </span>
          </h1>
          <p
            className="mt-2 font-mono text-[10px] uppercase tracking-label text-ink-500"
            style={{ animationDelay: "80ms" }}
          >
            Transcript in — the extractor pulls subject, clothing, and trail
          </p>

          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              onOpenIncident();
            }}
          >
            <textarea
              value={transcript}
              onChange={(event) => onTranscriptChange(event.target.value)}
              rows={8}
              disabled={busy}
              placeholder="Paste dispatch transcript here, or upload a call"
              className={`${inputClass} resize-y`}
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) {
                  return;
                }
                setIsTranscribing(true);
                void onTranscribeAudio(file).finally(() => setIsTranscribing(false));
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                disabled={busy}
                className={`${buttonSecondary} flex-1`}
              >
                {isTranscribing ? "Transcribing…" : "Upload call audio"}
              </button>
              <button
                type="submit"
                disabled={busy || !transcript.trim()}
                className={`${buttonPrimary} flex-1`}
              >
                Transmit →
              </button>
            </div>
          </form>
        </section>
      </Corners>

      <ol className="mt-8 flex w-full max-w-[720px] flex-wrap items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-label text-ink-400 animate-boot-in">
        <li className="text-signal">01 Locate</li>
        <li className="text-ink-600" aria-hidden>
          ─
        </li>
        <li>02 Scan</li>
        <li className="text-ink-600" aria-hidden>
          ─
        </li>
        <li>03 Rescue</li>
      </ol>
      <p className="mt-2 max-w-md text-center text-[12px] leading-relaxed text-ink-500">
        Transcript in, last-known pin set, search route planned. Footage returns the subject.
        Landing zone and a walk-back path for the ground team.
      </p>

      <div className="mt-6 w-full max-w-[720px] text-center">
        <button type="button" onClick={onSeedData} className={buttonGhost}>
          Load fixture
        </button>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
          Fills every beat from the committed fixture — subject, corridor, planned search route,
          scan detections, frame evidence, landing zones and the walk-back path. No backend needed
          to walk the interface. Fixture data is always badged.
        </p>
      </div>

      {errorMessage ? (
        <div className="mt-6 w-full max-w-[720px]">
          <ErrorBanner message={errorMessage} />
        </div>
      ) : null}
    </div>
  );
}

function UnavailableState({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 py-16 text-center">
      <h2 className="text-xl font-semibold tracking-tight text-ink-50">Incident unavailable</h2>
      <p className="text-sm text-ink-400">{message}</p>
      <p className="text-xs text-ink-500">
        Nothing cached in this tab for that id, and the server did not answer.
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <button type="button" onClick={onRetry} className={buttonSecondary}>
          Retry
        </button>
        <Link href="/" className={buttonGhost}>
          New incident
        </Link>
      </div>
    </div>
  );
}

export function hasSubjectFix(presented: PresentedIncident): boolean {
  if (presented.job?.situation?.groundPoint) {
    return true;
  }
  return (presented.job?.detections ?? []).some(
    (detection) => detection.className === "person" && detection.groundPoint,
  );
}

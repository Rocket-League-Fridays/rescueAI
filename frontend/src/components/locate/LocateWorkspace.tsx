"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DataOriginBanner } from "@/components/DataOriginBanner";
import { IncidentStageNav } from "@/components/IncidentStageNav";
import { LastKnownForm } from "@/components/locate/LastKnownForm";
import { ScanMonitor } from "@/components/locate/ScanMonitor";
import { SearchParamsForm } from "@/components/locate/SearchParamsForm";
import { SearchRoutePanel } from "@/components/locate/SearchRoutePanel";
import { SortieForm } from "@/components/locate/SortieForm";
import { SubjectReviewForm } from "@/components/locate/SubjectReviewForm";
import { TranscriptForm } from "@/components/locate/TranscriptForm";
import { TacticalMap } from "@/components/TacticalMap";
import { EmptyState } from "@/components/ui";
import { createApiClient } from "@/lib/api-client";
import { createOverrideStore, type IncidentOverrides } from "@/lib/incident-overrides";
import { createSnapshotStore, type Staleness } from "@/lib/incident-snapshot";
import { createIncidentSource } from "@/lib/incident-source";
import {
  createFixtureSearchRouteSource,
  createSearchRouteSource,
} from "@/lib/search-route-source";
import { LocatePresenter, type SearchParameters } from "@/presenter/LocatePresenter";
import type { LocateView } from "@/presenter/LocateView";
import type { PresentedIncident } from "@/presenter/IncidentPageView";
import type { LastKnownPosition } from "@/types/search";
import type { GeoPoint } from "@/types/telemetry";

const DEFAULT_SEARCH_PARAMETERS: SearchParameters = {
  patternKind: "parallel_track",
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
  const [searchParameters, setSearchParameters] = useState<SearchParameters>(
    DEFAULT_SEARCH_PARAMETERS,
  );

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
    );
  }, []);

  useEffect(() => {
    if (incidentId === null) {
      return;
    }
    void presenter.hydrate(incidentId);
    return () => presenter.stopScanPolling();
  }, [incidentId, presenter]);

  // Keep the planner form in step with whatever route is actually loaded.
  useEffect(() => {
    const route = presented?.searchRoute;
    if (route) {
      setSearchParameters({
        patternKind: route.patternKind,
        altitudeAglMeters: route.altitudeAglMeters,
        overlapPercent: route.overlapPercent,
      });
    }
  }, [presented?.searchRoute]);

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

  function handleRevertLastKnown() {
    if (!incidentId || !presented) {
      return;
    }
    const next = { ...presented.overrides };
    delete next.lastKnownPoint;
    delete next.lastKnownRadiusMeters;
    presenter.saveOverrides(incidentId, next);
  }

  if (incidentId === null) {
    return (
      <IntakeLanding
        transcript={transcript}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onTranscriptChange={setTranscript}
        onOpenIncident={() => void presenter.openIncident(transcript)}
        onLoadFixtureTranscript={() => void presenter.loadFixtureTranscript()}
        onLoadMockSortie={() => presenter.loadMockSortie()}
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
    return <LoadingState />;
  }

  const { incident, job, searchRoute, origin, overrides, lastKnown } = presented;
  const rescueReady = hasSubjectFix(presented);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <IncidentStageNav incidentId={incidentId} stage="locate" rescueReady={rescueReady} />
        <button
          type="button"
          onClick={() => void presenter.refresh(incidentId)}
          disabled={isLoading}
          className="rounded border border-olive-700 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-olive-300 hover:border-olive-500 disabled:opacity-40"
        >
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <DataOriginBanner origin={origin} staleness={staleness} />
      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="h-[420px]">
            <TacticalMap
              incident={incident}
              job={job}
              focus="locate"
              lastKnown={lastKnown.position}
              searchRoute={searchRoute}
              onLastKnownDragged={handleLastKnownDragged}
              title="Search area"
              minHeightClass="min-h-[420px]"
            />
          </div>
          <SearchRoutePanel
            route={searchRoute}
            incidentLabel={incident.subject.displayName || "incident"}
            plannerMessage={plannerMessage}
          />
          <ScanMonitor
            job={job}
            incident={incident}
            onGoToRescue={() => presenter.goToRescue(incidentId)}
          />
        </div>

        <aside className="space-y-4">
          <LastKnownForm
            lastKnown={lastKnown.position}
            source={lastKnown.source}
            onChange={handleLastKnownChange}
            onRevert={handleRevertLastKnown}
          />
          <SearchParamsForm
            parameters={searchParameters}
            isPlanning={isPlanning}
            disabled={false}
            onChange={setSearchParameters}
            onPlan={() =>
              void presenter.planSearchRoute(incidentId, lastKnown.position, searchParameters)
            }
          />
          <SubjectReviewForm
            incident={incident}
            overrides={overrides}
            onChange={handleOverridesChange}
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
        </aside>
      </div>
    </div>
  );
}

function IntakeLanding({
  transcript,
  isLoading,
  errorMessage,
  onTranscriptChange,
  onOpenIncident,
  onLoadFixtureTranscript,
  onLoadMockSortie,
}: {
  transcript: string;
  isLoading: boolean;
  errorMessage: string | null;
  onTranscriptChange(value: string): void;
  onOpenIncident(): void;
  onLoadFixtureTranscript(): void;
  onLoadMockSortie(): void;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <div className="grid gap-4 md:grid-cols-2">
        <TranscriptForm
          transcript={transcript}
          isLoading={isLoading}
          isOpened={false}
          onTranscriptChange={onTranscriptChange}
          onOpenIncident={onOpenIncident}
          onLoadFixtureTranscript={onLoadFixtureTranscript}
          onLoadMockSortie={onLoadMockSortie}
        />
        <FlowExplainer />
      </div>
      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
    </div>
  );
}

function FlowExplainer() {
  const steps = [
    ["1 · Locate", "Transcript in, last-known pin set, search route planned and exported."],
    ["2 · Scan", "Recorded sortie runs through detection and returns the subject's position."],
    ["3 · Rescue", "Landing zone sited and a walk-back path drawn for the ground team."],
  ];
  return (
    <section className="rounded-lg border border-olive-700 bg-tactical-900 p-4">
      <h2 className="font-mono text-xs uppercase tracking-widest text-olive-200">Flow</h2>
      <ol className="mt-3 space-y-3">
        {steps.map(([title, body]) => (
          <li key={title} className="border-l-2 border-olive-700 pl-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-olive-300">
              {title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-olive-400">{body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded border border-dashed border-olive-800 px-3 py-2 text-[10px] leading-relaxed text-olive-500">
        No backend needed to walk the interface — use{" "}
        <span className="text-olive-300">Dev · load mock sortie</span> for the committed fixture.
        Fixture data is always badged.
      </p>
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-200">
      {message}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <EmptyState>Loading incident…</EmptyState>
    </div>
  );
}

function UnavailableState({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 py-16 text-center">
      <h2 className="font-mono text-sm uppercase tracking-widest text-olive-200">
        Incident unavailable
      </h2>
      <p className="text-sm text-olive-400">{message}</p>
      <p className="text-xs text-olive-500">
        Nothing cached in this tab for that id, and the server did not answer.
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-olive-600 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-olive-200 hover:border-olive-400"
        >
          Retry
        </button>
        <Link
          href="/"
          className="rounded border border-olive-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-olive-400 hover:border-olive-500"
        >
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

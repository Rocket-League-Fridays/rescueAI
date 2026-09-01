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
import { buttonGhost, buttonPrimary, buttonSecondary, EmptyState } from "@/components/ui";
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
  /** Where the landing's Rescue tab points until the store says this tab has a better answer. */
  const [rescueTarget, setRescueTarget] = useState(FIXTURE_INCIDENT_ID);

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

  // Read after mount: the recent-incident store is sessionStorage, which does not exist during
  // prerender, so resolving this during render would desync the server and client markup.
  useEffect(() => {
    if (incidentId === null) {
      presenter.forgetRecentIncident();
      setRescueTarget(presenter.rescueTargetIncidentId());
    }
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
        rescueTarget={rescueTarget}
        onTranscriptChange={setTranscript}
        onOpenIncident={() => void presenter.openIncident(transcript)}
        onSeedData={() => presenter.seedMockIncident()}
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
          className={buttonGhost}
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
  rescueTarget,
  onTranscriptChange,
  onOpenIncident,
  onSeedData,
}: {
  transcript: string;
  isLoading: boolean;
  errorMessage: string | null;
  rescueTarget: string;
  onTranscriptChange(value: string): void;
  onOpenIncident(): void;
  onSeedData(): void;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <IncidentStageNav incidentId={rescueTarget} stage="locate" locateHref="/" />
      <div className="grid gap-4 md:grid-cols-2">
        <TranscriptForm
          transcript={transcript}
          isLoading={isLoading}
          isOpened={false}
          onTranscriptChange={onTranscriptChange}
          onOpenIncident={onOpenIncident}
        />
        <FlowExplainer onSeedData={onSeedData} />
      </div>
      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
    </div>
  );
}

function FlowExplainer({ onSeedData }: { onSeedData(): void }) {
  const steps = [
    ["1 · Locate", "Transcript in, last-known pin set, search route planned and exported."],
    ["2 · Scan", "Footage runs through detection and returns the subject's position."],
    ["3 · Rescue", "Landing zone sited and a walk-back path drawn for the ground team."],
  ];
  return (
    <section className="rounded-lg border border-line bg-surface-raised p-5 shadow-panel">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink-100">Flow</h2>
      <ol className="mt-4 space-y-4">
        {steps.map(([title, body], index) => (
          <li key={title} className="flex gap-3">
            <span
              className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line-strong bg-surface-sunken font-mono text-[11px] text-ink-300"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-tight text-ink-100">
                {title.replace(/^\d+ · /, "")}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-400">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 rounded-md border border-dashed border-line-soft p-3">
        <button type="button" onClick={onSeedData} className={`${buttonPrimary} w-full`}>
          Seed data
        </button>
        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-500">
          Fills every beat from the committed fixture — subject, corridor, planned search route,
          scan detections, frame evidence, landing zones and the walk-back path. No backend needed
          to walk the interface. Fixture data is always badged.
        </p>
      </div>
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-status-critical/50 bg-status-critical/10 px-3 py-2.5 text-[13px] text-status-critical">
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
      <h2 className="text-xl font-semibold tracking-tight text-ink-50">
        Incident unavailable
      </h2>
      <p className="text-sm text-ink-400">{message}</p>
      <p className="text-xs text-ink-500">
        Nothing cached in this tab for that id, and the server did not answer.
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={onRetry}
          className={buttonSecondary}
        >
          Retry
        </button>
        <Link
          href="/"
          className={buttonGhost}
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

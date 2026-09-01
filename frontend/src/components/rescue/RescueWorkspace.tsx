"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CommandSurface } from "@/components/CommandSurface";
import { ExportMenu } from "@/components/ExportMenu";
import { IncidentStageNav } from "@/components/IncidentStageNav";
import { CLOTHING_ALERT_THRESHOLD } from "@/components/locate/ScanMonitor";
import { usePublishMission } from "@/components/MissionContext";
import { GamePlanPanel } from "@/components/rescue/GamePlanPanel";
import { SituationCard } from "@/components/rescue/SituationCard";
import { SubjectAlert } from "@/components/rescue/SubjectAlert";
import { StreamViewer } from "@/components/StreamViewer";
import { TacticalMap } from "@/components/TacticalMap";
import { buttonGhost, buttonSecondary, EmptyState, hudPanelClass, labelClass } from "@/components/ui";
import { createApiClient } from "@/lib/api-client";
import { createArtifactContentSource } from "@/lib/artifact-content";
import { createOverrideStore } from "@/lib/incident-overrides";
import { createSnapshotStore, type Staleness } from "@/lib/incident-snapshot";
import { createIncidentSource, NO_INCIDENT_ID } from "@/lib/incident-source";
import { rescueRouteToExportable } from "@/lib/route-export";
import type { PresentedIncident } from "@/presenter/IncidentPageView";
import { RescuePresenter } from "@/presenter/RescuePresenter";
import type { RescueView } from "@/presenter/RescueView";

export function RescueWorkspace({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const [presented, setPresented] = useState<PresentedIncident | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [staleness, setStaleness] = useState<Staleness | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const apiClient = useMemo(() => createApiClient(), []);
  const artifactContent = useMemo(() => createArtifactContentSource(apiClient), [apiClient]);
  const presenter = useMemo(() => {
    const view: RescueView = {
      setIsLoading,
      displayErrorMessage: setErrorMessage,
      clearErrorMessage: () => setErrorMessage(null),
      displayIncident: (next) => {
        setPresented(next);
        setUnavailable(null);
      },
      displayStaleness: setStaleness,
      displayUnavailable: setUnavailable,
      navigateToLocate: (id) => routerRef.current.push(`/locate/${id}`),
    };
    return new RescuePresenter(
      view,
      createIncidentSource(apiClient),
      createSnapshotStore(),
      createOverrideStore(),
    );
  }, [apiClient]);

  useEffect(() => {
    if (incidentId === NO_INCIDENT_ID) {
      return;
    }
    void presenter.hydrate(incidentId);
  }, [incidentId, presenter]);

  const onRefresh = useCallback(() => {
    void presenter.refresh(incidentId);
  }, [incidentId, presenter]);

  usePublishMission({
    incidentId: incidentId === NO_INCIDENT_ID ? undefined : incidentId,
    rescueReady: incidentId === NO_INCIDENT_ID ? undefined : true,
    jobStatus: presented?.job?.status ?? (incidentId === NO_INCIDENT_ID ? undefined : null),
    onRefresh: incidentId === NO_INCIDENT_ID ? undefined : onRefresh,
    isRefreshing: isLoading,
  });

  if (incidentId === NO_INCIDENT_ID) {
    return <RescuePlaceholder />;
  }

  if (unavailable !== null) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-16 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-ink-50">Incident unavailable</h2>
        <p className="text-sm text-ink-400">{unavailable}</p>
        <p className="text-xs text-ink-500">
          Nothing cached in this tab for that id, and the server did not answer.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <button type="button" onClick={() => void presenter.hydrate(incidentId)} className={buttonSecondary}>
            Retry
          </button>
          <Link href={`/locate/${incidentId}`} className={buttonGhost}>
            Back to locate
          </Link>
        </div>
      </div>
    );
  }

  if (presented === null) {
    return (
      <div className="px-4 py-8">
        <EmptyState>Loading incident…</EmptyState>
      </div>
    );
  }

  const { incident, job, origin, lastKnown } = presented;
  const route = job?.route ?? null;
  const clothingAlerts = (job?.detections ?? []).filter(
    (detection) =>
      detection.className === "person" &&
      (detection.clothingMatchScore ?? 0) >= CLOTHING_ALERT_THRESHOLD,
  );

  return (
    <CommandSurface
      origin={origin}
      staleness={staleness}
      errorMessage={errorMessage}
      map={
        <TacticalMap
          incident={incident}
          job={job}
          focus="rescue"
          lastKnown={lastKnown.position}
          searchRoute={presented.searchRoute}
          title="Rescue map"
          bleed
        />
      }
      left={
        <>
          {clothingAlerts.length > 0 ? (
            <SubjectAlert detections={clothingAlerts} incident={incident} />
          ) : null}
          {job?.situation ? <SituationCard situation={job.situation} /> : null}
          <section className={`${hudPanelClass} p-3`}>
            <p className={labelClass}>Ground team brief</p>
            <dl className="mt-3 space-y-2 text-xs">
              <Brief label="Subject" value={incident.subject.displayName || "—"} />
              <Brief
                label="Clothing"
                value={incident.subject.clothingColors.join(", ") || "not recorded"}
              />
              <Brief label="Corridor" value={incident.trailName || "—"} />
              <Brief
                label="Landing zones"
                value={`${job?.landingZones.length ?? 0} candidate${
                  (job?.landingZones.length ?? 0) === 1 ? "" : "s"
                }`}
              />
            </dl>
            {incident.subject.notes ? (
              <p className="mt-3 border-t border-line-soft pt-3 text-xs leading-relaxed text-ink-400">
                {incident.subject.notes}
              </p>
            ) : null}
          </section>
        </>
      }
      right={
        <GamePlanPanel
          incident={incident}
          job={job}
          actions={
            <ExportMenu
              route={
                route
                  ? rescueRouteToExportable(route, incident.subject.displayName || "incident")
                  : null
              }
              label="Export path"
            />
          }
        />
      }
      dock={
        <StreamViewer
          job={job ?? null}
          subjectName={incident.subject.displayName || undefined}
          artifactContentUrl={(artifactId) => artifactContent.urlFor(artifactId)}
          dock
        />
      }
    />
  );
}

function RescuePlaceholder() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
      <IncidentStageNav incidentId={NO_INCIDENT_ID} stage="rescue" locateHref="/" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className={`${hudPanelClass} flex h-[460px] flex-col p-4`}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-50">
              Rescue map
            </h2>
            <div className="mt-3 flex-1">
              <EmptyState>No incident started. Open an issue on the locate tab.</EmptyState>
            </div>
          </section>
          <section className={`${hudPanelClass} p-4`}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-50">
              Walk-back route
            </h2>
            <div className="mt-3">
              <EmptyState>No route planned yet.</EmptyState>
            </div>
          </section>
        </div>
        <aside className="space-y-4">
          <section className={`${hudPanelClass} p-4`}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-50">
              Ground team brief
            </h2>
            <dl className="mt-3 space-y-2 text-xs">
              <Brief label="Subject" value="—" />
              <Brief label="Clothing" value="not recorded" />
              <Brief label="Corridor" value="—" />
              <Brief label="Landing zones" value="0 candidates" />
            </dl>
          </section>
          <section className={`${hudPanelClass} p-4`}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-50">
              Live feed
            </h2>
            <div className="mt-3">
              <EmptyState>No footage yet.</EmptyState>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Brief({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-[10px] uppercase tracking-label text-ink-500">{label}</dt>
      <dd className="min-w-0 truncate text-right text-ink-100">{value}</dd>
    </div>
  );
}

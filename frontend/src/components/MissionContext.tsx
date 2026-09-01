"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { JobStatus } from "@/types/telemetry";

export interface MissionExtras {
  rescueReady?: boolean;
  jobStatus?: JobStatus | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  incidentId?: string;
}

interface MissionContextValue {
  extras: MissionExtras;
  setExtras(next: MissionExtras): void;
}

const MissionContext = createContext<MissionContextValue>({
  extras: {},
  setExtras: () => undefined,
});

export function MissionProvider({ children }: { children: ReactNode }) {
  const [extras, setExtras] = useState<MissionExtras>({});
  const value = useMemo(() => ({ extras, setExtras }), [extras]);
  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

export function useMissionExtras(): MissionExtras {
  return useContext(MissionContext).extras;
}

export function usePublishMission(extras: MissionExtras): void {
  const { setExtras } = useContext(MissionContext);
  useEffect(() => {
    setExtras(extras);
    return () => setExtras({});
    // Field-level deps: the extras object is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    extras.incidentId,
    extras.rescueReady,
    extras.jobStatus,
    extras.isRefreshing,
    extras.onRefresh,
    setExtras,
  ]);
}

import { createJsonStore, type JsonStore } from "@/lib/session-store";
import type { IncidentDetail } from "@/types/incident";
import type { SearchRoute } from "@/types/search";
import type { JobDetail } from "@/types/telemetry";

/** Where a snapshot came from. `fixture` must always be badged in the UI. */
export type DataOrigin = "live" | "fixture";

/** Everything both pages need to render one incident, captured at a single moment. */
export interface IncidentSnapshot {
  incident: IncidentDetail;
  job: JobDetail | null;
  searchRoute: SearchRoute | null;
  origin: DataOrigin;
  fetchedAt: string;
}

/**
 * Last-known-good cache. Its only job is to make sure a reload or a failed refresh never leaves
 * the operator staring at an empty screen mid-incident.
 */
export interface SnapshotStore {
  read(incidentId: string): IncidentSnapshot | null;
  write(snapshot: IncidentSnapshot): void;
}

class StoredSnapshotStore implements SnapshotStore {
  constructor(private readonly store: JsonStore<IncidentSnapshot>) {}

  read(incidentId: string): IncidentSnapshot | null {
    return this.store.read(incidentId);
  }

  write(snapshot: IncidentSnapshot): void {
    this.store.write(snapshot.incident.id, snapshot);
  }
}

export function createSnapshotStore(): SnapshotStore {
  return new StoredSnapshotStore(createJsonStore<IncidentSnapshot>("rescueai.snapshot"));
}

/** Why the view is showing something older than a successful fetch. */
export interface Staleness {
  fetchedAt: string;
  reason: string;
  status: number | null;
}

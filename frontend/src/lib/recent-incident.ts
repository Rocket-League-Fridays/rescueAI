import { createJsonStore, type JsonStore } from "@/lib/session-store";

/** One slot — this tab only ever cares about the incident it is currently working. */
const CURRENT_KEY = "current";

/**
 * Remembers which incident this tab last opened. The intake landing has no incident in its URL,
 * so without this the Rescue beat would be unreachable until an incident is opened again.
 */
export interface RecentIncidentStore {
  read(): string | null;
  write(incidentId: string): void;
  clear(): void;
}

class StoredRecentIncidentStore implements RecentIncidentStore {
  constructor(private readonly store: JsonStore<string>) {}

  read(): string | null {
    return this.store.read(CURRENT_KEY);
  }

  write(incidentId: string): void {
    this.store.write(CURRENT_KEY, incidentId);
  }

  clear(): void {
    this.store.clear(CURRENT_KEY);
  }
}

export function createRecentIncidentStore(): RecentIncidentStore {
  return new StoredRecentIncidentStore(createJsonStore<string>("rescueai.recent"));
}

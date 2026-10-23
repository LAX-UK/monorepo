import type { createDb } from "@auction/db";
import type { WorkerEnv } from "../env.js";
import { loadAtgRuntimeConfig } from "../integrations/atg/atg-config.js";
import { AtgSyncService } from "../integrations/atg/atg-sync-service.js";
import { DrizzleAtgSyncStore } from "../integrations/atg/drizzle-atg-sync-store.js";
import { GapHttpAdapter } from "../integrations/atg/gap-http-adapter.js";

export type AtgSyncRuntime = {
  service: AtgSyncService;
  pollIntervalMs: number;
  listingPrivate: boolean;
};

/** Null while ATG_SYNC_ENABLED is off, so a disabled deployment builds no ATG client or store. */
export function createAtgSyncRuntime(deps: {
  env: WorkerEnv;
  db: ReturnType<typeof createDb>;
  onTickError: (saleId: string, err: unknown) => void;
}): AtgSyncRuntime | null {
  const config = loadAtgRuntimeConfig(deps.env);
  if (!config) return null;
  return {
    service: new AtgSyncService({
      gateway: new GapHttpAdapter(config.adapter),
      store: new DrizzleAtgSyncStore(deps.db),
      config: config.sync,
      onTickError: deps.onTickError,
    }),
    pollIntervalMs: config.pollIntervalMs,
    listingPrivate: config.sync.listingPrivate,
  };
}

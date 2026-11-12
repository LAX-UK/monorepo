import { ArtworkOfferLock } from "@auction/artwork-register-contracts";
import type { createDb } from "@auction/db";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleLotRegisterLinkReader,
} from "@auction/persistence/repositories";
import type { WorkerEnv } from "../env.js";
import { type AtgConfigCheckResult, checkAtgConfig } from "../integrations/atg/atg-config-check.js";
import { loadAtgRuntimeConfig } from "../integrations/atg/atg-config.js";
import { HttpAtgImageInspector } from "../integrations/atg/atg-image-inspector.js";
import { AtgSoldRegisterService } from "../integrations/atg/atg-sold-register.js";
import { AtgSyncService } from "../integrations/atg/atg-sync-service.js";
import { DrizzleAtgSyncStore } from "../integrations/atg/drizzle-atg-sync-store.js";
import { GapHttpAdapter } from "../integrations/atg/gap-http-adapter.js";

export type AtgSyncRuntime = {
  service: AtgSyncService;
  pollIntervalMs: number;
  /** One-off startup comparison of the configured values with ATG; resolves, never rejects. */
  checkConfig: () => Promise<void>;
};

/** Null while ATG_SYNC_ENABLED is off, so a disabled deployment builds no ATG client or store. */
export function createAtgSyncRuntime(deps: {
  env: WorkerEnv;
  db: ReturnType<typeof createDb>;
  onTickError: (saleId: string, err: unknown) => void;
  onFeeMismatch: (saleId: string, message: string) => void;
  onConfigCheck: (result: AtgConfigCheckResult) => void;
}): AtgSyncRuntime | null {
  const config = loadAtgRuntimeConfig(deps.env);
  if (!config) return null;
  const gateway = new GapHttpAdapter(config.adapter);
  const registerRepository = new DrizzleArtworkRegisterRepository(deps.db);
  return {
    service: new AtgSyncService({
      gateway,
      store: new DrizzleAtgSyncStore(deps.db),
      imageInspector: new HttpAtgImageInspector(),
      config: config.sync,
      onTickError: deps.onTickError,
      onFeeMismatch: deps.onFeeMismatch,
      soldRegister: new AtgSoldRegisterService(
        new ArtworkOfferLock(registerRepository),
        new DrizzleLotRegisterLinkReader(deps.db),
        registerRepository,
      ),
    }),
    pollIntervalMs: config.pollIntervalMs,
    checkConfig: async () => {
      deps.onConfigCheck(await checkAtgConfig(gateway, config.sync));
    },
  };
}

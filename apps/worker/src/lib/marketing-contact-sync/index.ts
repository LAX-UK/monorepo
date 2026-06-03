import type { WorkerEnv } from "../../env.js";
import { BrevoContactSync } from "./brevo.js";
import type { IMarketingContactSync } from "./types.js";

export type { IMarketingContactSync, MarketingContact, SyncResult } from "./types.js";
export { BrevoContactSync } from "./brevo.js";

/**
 * Composition-root factory: returns the configured marketing-contact-sync adapter,
 * or `null` when disabled (`MARKETING_CONTACT_SYNC_PROVIDER=none`) or missing creds.
 * Env validation already enforces creds when a provider is selected; the guards here
 * keep the worker resilient if that ever changes.
 */
export function createMarketingContactSync(
  env: WorkerEnv,
  deps: { fetchImpl?: typeof fetch } = {},
): IMarketingContactSync | null {
  switch (env.MARKETING_CONTACT_SYNC_PROVIDER) {
    case "brevo": {
      if (!env.BREVO_API_KEY || !env.BREVO_LIST_ID) return null;
      const adapter = new BrevoContactSync({
        apiKey: env.BREVO_API_KEY,
        listId: env.BREVO_LIST_ID,
        ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
      });
      return adapter.enabled() ? adapter : null;
    }
    default:
      return null;
  }
}

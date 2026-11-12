import { ZOHO_TOKEN_FAILING_STREAK } from "@auction/artwork-register-contracts";
import type { IZohoSyncHealthStore } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import type { ZohoTokenRefreshObserver } from "./oauth-token-refresh.js";

/**
 * Keeps how the Zoho token refresh is doing where LAX Admin's Sync health tab reads it, and
 * raises the alert when it fails twice in a row: an error log line, and the tab shows the staff
 * notice from the same record. A good refresh ends the streak. Recording is best-effort: a
 * failure to record is logged and never reaches the code that asked for a token.
 */
export class ZohoTokenHealthMonitor implements ZohoTokenRefreshObserver {
  constructor(
    private readonly deps: {
      store: Pick<IZohoSyncHealthStore, "recordTokenRefreshed" | "recordTokenRefreshFailed">;
      log: Logger;
      now?: () => Date;
    },
  ) {}

  private now(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }

  refreshed(expiresAt: Date): void {
    void this.deps.store.recordTokenRefreshed(expiresAt, this.now()).catch((error: unknown) => {
      this.deps.log.warn({ err: error }, "zoho_token_health_record_failed");
    });
  }

  failed(code: string): void {
    void this.recordFailure(code);
  }

  private async recordFailure(code: string): Promise<void> {
    const { log, store } = this.deps;
    try {
      const { failureStreak } = await store.recordTokenRefreshFailed(code, this.now());
      if (failureStreak === ZOHO_TOKEN_FAILING_STREAK) {
        log.error(
          { alert: "zoho_token_refresh_failing", failureStreak, code },
          "Zoho token refresh has failed twice in a row; Zoho syncs cannot reach Zoho until it is fixed",
        );
      } else {
        log.warn({ failureStreak, code }, "zoho_token_refresh_failed");
      }
    } catch (error) {
      log.warn({ err: error, code }, "zoho_token_health_record_failed");
    }
  }
}

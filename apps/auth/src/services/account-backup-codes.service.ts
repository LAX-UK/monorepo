import type { SecurityNoticePublisher } from "@auction/auth";
import type { ReauthRequired } from "./account-contact.service.js";
import type { IdentityOperationsService } from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";

export type AccountBackupCodesPorts = {
  operations: Pick<IdentityOperationsService, "listSessions">;
  /** Replaces the person's stored backup codes and returns the new set; null without two-step verification. */
  regenerate(subjectId: string): Promise<string[] | null>;
  /** Tells the account's email that new codes were created. Never throws. */
  notices: SecurityNoticePublisher;
};

export type RegenerateBackupCodesResult =
  | { ok: true; backupCodes: string[] }
  | ReauthRequired
  | { ok: false; reason: "two_factor_not_enabled" };

/**
 * Creating a new set of backup codes for the signed-in person, from LAX Account.
 *
 * Replacing the codes ends the old ones, so it needs a recent sign-in, checked against the
 * caller's own session exactly as for the other sensitive changes. The codes are returned once,
 * to the caller, and are never stored in readable form or logged; the email says only that new
 * codes were created.
 */
export class AccountBackupCodesService {
  private readonly sessions: RecentSessionGuard;

  constructor(
    private readonly ports: AccountBackupCodesPorts,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.sessions = new RecentSessionGuard(ports.operations, now);
  }

  async regenerate(
    subjectId: string,
    currentSessionId: string,
  ): Promise<RegenerateBackupCodesResult> {
    const current = await this.sessions.findRecent(subjectId, currentSessionId);
    if (!current) return { ok: false, reason: "reauth_required" };
    const backupCodes = await this.ports.regenerate(subjectId);
    if (!backupCodes) return { ok: false, reason: "two_factor_not_enabled" };
    void this.ports.notices.notify({
      kind: "backup_codes_regenerated",
      userId: subjectId,
      at: this.now(),
      userAgent: current.userAgent,
    });
    return { ok: true, backupCodes };
  }
}

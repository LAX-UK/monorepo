import {
  STAFF_STEP_UP_MAX_AGE_SECONDS,
  isRecentStaffAuthentication,
} from "@auction/identity-contracts";
import type { IIdentitySessionClient } from "./interfaces/identity-issuer-client.js";

/** Answers whether a staff member's current sign-in is recent enough for a dangerous action. */
export interface IStaffStepUpGuard {
  isRecent(input: { subjectId: string; sessionId: string }): Promise<boolean>;
}

/**
 * Keys on the Identity session's own authentication time: when it was created (the `auth_time`
 * Identity put in the ID token) or when its password was last confirmed, whichever is later.
 * A person who signs in again, or confirms their password, starts a fresh window.
 */
export class StaffStepUpService implements IStaffStepUpGuard {
  private readonly now: () => Date;
  private readonly maxAgeSeconds: number;

  constructor(
    private readonly sessions: Pick<IIdentitySessionClient, "listSessions">,
    options: { now?: () => Date; maxAgeSeconds?: number } = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.maxAgeSeconds = options.maxAgeSeconds ?? STAFF_STEP_UP_MAX_AGE_SECONDS;
  }

  async isRecent(input: { subjectId: string; sessionId: string }): Promise<boolean> {
    const nowMs = this.now().getTime();
    const sessions = await this.sessions.listSessions(input.subjectId, input.sessionId);
    const current = sessions.find(
      (row) => (row.isCurrent || row.id === input.sessionId) && row.expiresAt.getTime() > nowMs,
    );
    if (!current) return false;
    const authenticatedAtMs = Math.max(
      current.createdAt.getTime(),
      current.lastPasswordAuthAt?.getTime() ?? 0,
    );
    return isRecentStaffAuthentication({
      authTimeSeconds: Math.floor(authenticatedAtMs / 1000),
      nowSeconds: Math.floor(nowMs / 1000),
      maxAgeSeconds: this.maxAgeSeconds,
    });
  }
}

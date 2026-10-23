import { ACCOUNT_STEP_UP_MAX_AGE_SECONDS } from "@auction/identity-contracts";
import type { IdentityOperationsService, IdentitySession } from "./identity-operations.service.js";

/**
 * Decides whether the sign-in LAX Account holds (its `sid`) is genuine and recent enough for a
 * sensitive change. The recency check reads the session's own creation time, the value the
 * issuer put in the ID token as `auth_time`, rather than a timestamp the caller reports; and
 * the session must belong to the subject, so naming someone else's session never succeeds.
 */
export class RecentSessionGuard {
  constructor(
    private readonly operations: Pick<IdentityOperationsService, "listSessions">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async liveSessions(subjectId: string): Promise<IdentitySession[]> {
    const nowMs = this.now().getTime();
    const sessions = await this.operations.listSessions(subjectId);
    return sessions.filter((session) => session.expiresAt.getTime() > nowMs);
  }

  async findRecent(subjectId: string, sessionId: string): Promise<IdentitySession | null> {
    const session = (await this.liveSessions(subjectId)).find((row) => row.id === sessionId);
    if (!session) return null;
    const ageSeconds = (this.now().getTime() - session.createdAt.getTime()) / 1_000;
    return ageSeconds >= 0 && ageSeconds <= ACCOUNT_STEP_UP_MAX_AGE_SECONDS ? session : null;
  }
}

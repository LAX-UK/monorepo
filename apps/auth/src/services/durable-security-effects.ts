import type { IdentityEventPublisher } from "@auction/auth";
import type { BackchannelLogoutRevoker } from "./backchannel-logout-revocation.service.js";
import type { IdentityOperationsService } from "./identity-operations.service.js";
import {
  type SecurityEffectLogger,
  describeError,
  retryInBackground,
} from "./settle-security-effect.js";

/**
 * A security side effect that must still happen after the change that needs it has committed.
 * Every kind is idempotent, because a job may run twice if a worker stops between doing the work
 * and deleting the row.
 */
export type SecurityEffectJob =
  /** Deletes the person's other issuer sessions. */
  | { kind: "end_other_identity_sessions"; userId: string; keepSessionId: string }
  /** Ends relying-party sessions and tokens for everything except one issuer session. */
  | { kind: "revoke_tokens_except_session"; userId: string; keepSessionId: string }
  | { kind: "revoke_identity_sessions"; userId: string; sessionIds: readonly string[] }
  | { kind: "revoke_subject_tokens"; userId: string }
  | { kind: "publish_session_revoked"; userId: string; sessionId?: string }
  | { kind: "publish_credential_changed"; userId: string };

export type SecurityEffectKind = SecurityEffectJob["kind"];

export type StoredSecurityEffect = {
  id: string;
  job: SecurityEffectJob;
  /** Attempts made so far, the immediate one included. */
  attemptCount: number;
};

export type SecurityEffectOutboxRepository = {
  enqueue(input: { job: SecurityEffectJob; error: string; nextAttemptAt: Date }): Promise<void>;
  /** Marks due jobs as running so two workers never take the same one, and returns them. */
  claimDue(input: { now: Date; staleBefore: Date; batchSize: number }): Promise<
    StoredSecurityEffect[]
  >;
  complete(id: string): Promise<void>;
  retryLater(input: {
    id: string;
    attemptCount: number;
    error: string;
    nextAttemptAt: Date;
    now: Date;
  }): Promise<void>;
  abandon(input: { id: string; attemptCount: number; error: string; now: Date }): Promise<void>;
};

export type SecurityEffectPorts = {
  operations: Pick<IdentityOperationsService, "removeOtherSessions">;
  logout: Pick<
    BackchannelLogoutRevoker,
    "revokeIdentitySessions" | "revokeSubject" | "revokeSubjectExceptIdentitySession"
  >;
  events: IdentityEventPublisher;
};

/**
 * Waits before each durable retry. Longer than the in-process schedule it replaced, because a
 * database or Redis outage can outlast a minute and a restart no longer loses the job.
 */
export const DURABLE_RETRY_DELAYS_MS = [2_000, 10_000, 60_000, 5 * 60_000, 30 * 60_000] as const;

/** A job claimed longer ago than this belongs to a worker that stopped, so it is taken again. */
const CLAIM_TIMEOUT_MS = 2 * 60_000;
const DRAIN_BATCH_SIZE = 50;

export function runSecurityEffect(
  ports: SecurityEffectPorts,
  job: SecurityEffectJob,
): Promise<void> {
  switch (job.kind) {
    case "end_other_identity_sessions":
      return ports.operations
        .removeOtherSessions(job.userId, job.keepSessionId)
        .then(() => undefined);
    case "revoke_tokens_except_session":
      return ports.logout
        .revokeSubjectExceptIdentitySession(job.userId, job.keepSessionId)
        .then(() => undefined);
    case "revoke_identity_sessions":
      return ports.logout.revokeIdentitySessions(job.sessionIds).then(() => undefined);
    case "revoke_subject_tokens":
      return ports.logout.revokeSubject(job.userId).then(() => undefined);
    case "publish_session_revoked":
      return ports.events.publish({
        type: "user.session_revoked",
        userId: job.userId,
        ...(job.sessionId ? { sessionId: job.sessionId } : {}),
      });
    case "publish_credential_changed":
      return ports.events.publish({
        type: "user.credential_changed",
        userId: job.userId,
        changeType: "update",
      });
  }
}

/**
 * Runs the side effects of an auth change that has already committed. The first attempt is
 * immediate, so the usual case has finished before the response returns. A failure is written
 * to the outbox in `auth_security_effect_outbox`, and `drain` retries it from there, so a restart
 * between attempts cannot lose a session or token revocation.
 *
 * `auth_security_effect_abandoned` is logged only once the durable retries are exhausted; that
 * is the line to alert on.
 */
export class DurableSecurityEffects {
  constructor(
    private readonly repository: SecurityEffectOutboxRepository,
    private readonly ports: SecurityEffectPorts,
    private readonly log: SecurityEffectLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * `attempt` overrides how the first attempt runs, for effects with a fuller path inside the
   * request (such as ending sessions through Better Auth with the caller's cookie). Retries
   * always run the job itself, which must not depend on the request.
   */
  async settle(
    path: string,
    job: SecurityEffectJob,
    attempt: () => Promise<void> = () => runSecurityEffect(this.ports, job),
  ): Promise<void> {
    const context = { path, effect: job.kind, userId: job.userId };
    try {
      await attempt();
      return;
    } catch (error) {
      this.log.error(
        { ...context, ...describeError(error), attempt: 1 },
        "auth_security_effect_failed",
      );
      try {
        await this.repository.enqueue({
          job,
          error: describeError(error).errorMessage,
          nextAttemptAt: new Date(this.now().getTime() + DURABLE_RETRY_DELAYS_MS[0]),
        });
      } catch (enqueueError) {
        this.log.error(
          { ...context, ...describeError(enqueueError) },
          "auth_security_effect_not_durable",
        );
        retryInBackground(this.log, context, () => runSecurityEffect(this.ports, job));
      }
    }
  }

  /** Retries every due job once. Returns how many ran. */
  async drain(): Promise<number> {
    const now = this.now();
    const due = await this.repository.claimDue({
      now,
      staleBefore: new Date(now.getTime() - CLAIM_TIMEOUT_MS),
      batchSize: DRAIN_BATCH_SIZE,
    });
    for (const stored of due) await this.retry(stored);
    return due.length;
  }

  private async retry({ id, job, attemptCount }: StoredSecurityEffect): Promise<void> {
    const context = { effect: job.kind, userId: job.userId };
    const attempt = attemptCount + 1;
    try {
      await runSecurityEffect(this.ports, job);
    } catch (error) {
      const { errorMessage } = describeError(error);
      this.log.error(
        { ...context, ...describeError(error), attempt },
        "auth_security_effect_failed",
      );
      const now = this.now();
      const delay = DURABLE_RETRY_DELAYS_MS[attempt - 1];
      if (delay === undefined) {
        await this.repository.abandon({ id, attemptCount: attempt, error: errorMessage, now });
        this.log.error({ ...context, attempts: attempt }, "auth_security_effect_abandoned");
        return;
      }
      await this.repository.retryLater({
        id,
        attemptCount: attempt,
        error: errorMessage,
        nextAttemptAt: new Date(now.getTime() + delay),
        now,
      });
      return;
    }
    await this.repository.complete(id);
    this.log.warn({ ...context, attempt }, "auth_security_effect_recovered");
  }
}

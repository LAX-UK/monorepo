import type {
  EmailEnqueueInput,
  EmailSender,
  IdentityEventPublisher,
  SecurityNoticeDelivery,
} from "@auction/auth";
import type { BackchannelLogoutRevoker } from "./backchannel-logout-revocation.service.js";
import type { IdentityOperationsService } from "./identity-operations.service.js";
import { redactedEmailFailure } from "./redacted-email-failure.js";
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
  | { kind: "publish_credential_changed"; userId: string }
  /** The reminder a week before the erasure; the address is read when it is sent. */
  | { kind: "send_account_deletion_reminder"; userId: string; effectiveAt: string }
  /**
   * The confirmation after the erasure. The address was copied just before the scrub and lives
   * only in this row: it is removed when the message is sent, or when the job is abandoned.
   */
  | { kind: "send_account_deleted_notice"; userId: string; email: string; erasedAt: string }
  /**
   * A verification, reset or sign-in email whose first hand-off failed. `input` carries the
   * one-time link and the address, so it is removed if the job is abandoned and it is never logged.
   * The idempotency key in it makes a repeated run reach the same queued message.
   */
  | { kind: "send_identity_email"; userId: string; input: EmailEnqueueInput };

export type SecurityEffectKind = SecurityEffectJob["kind"];

export type StoredSecurityEffect = {
  id: string;
  job: SecurityEffectJob;
  /** Attempts made so far, the immediate one included. */
  attemptCount: number;
};

export type SecurityEffectOutboxRepository = {
  /** Writes the job and returns the id of its row. */
  enqueue(input: { job: SecurityEffectJob; error: string; nextAttemptAt: Date }): Promise<string>;
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
  notices: SecurityNoticeDelivery;
  email: Pick<EmailSender, "enqueue">;
};

/**
 * Waits before each durable retry. Longer than the in-process schedule it replaced, because a
 * database or Redis outage can outlast a minute and a restart no longer loses the job.
 */
export const DURABLE_RETRY_DELAYS_MS = [2_000, 10_000, 60_000, 5 * 60_000, 30 * 60_000] as const;

/**
 * How long a reserved job waits before the drain may run it. Longer than the change it follows
 * takes, so the drain only picks it up when the process stopped before running it.
 */
const RESERVATION_GRACE_MS = 2 * 60_000;

/** Jobs written to the outbox ahead of the change they follow, run once that change is done. */
export type ReservedSecurityEffects = { run(): Promise<void> };

/** A job claimed longer ago than this belongs to a worker that stopped, so it is taken again. */
const CLAIM_TIMEOUT_MS = 2 * 60_000;
const DRAIN_BATCH_SIZE = 50;

/** What a retry logs. An email job names its template, never the person, so alerts carry no personal data. */
function retryLogContext(job: SecurityEffectJob): Record<string, string> {
  return job.kind === "send_identity_email"
    ? { effect: job.kind, template: job.input.template }
    : { effect: job.kind, userId: job.userId };
}

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
    case "send_account_deletion_reminder":
      return ports.notices.deliver({
        kind: "account_deletion_reminder",
        userId: job.userId,
        at: new Date(),
        effectiveAt: new Date(job.effectiveAt),
      });
    case "send_account_deleted_notice":
      return ports.notices.deliver({
        kind: "account_deletion_completed",
        userId: job.userId,
        at: new Date(job.erasedAt),
        email: job.email,
      });
    case "send_identity_email":
      return ports.email.enqueue(job.input).then(
        () => undefined,
        (error: unknown) => {
          throw new Error(redactedEmailFailure(error));
        },
      );
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

  /**
   * For effects that must not be lost to a crash between a change and its follow-up (ending a
   * person's products once their sign-in record has been deleted): writes the jobs to the outbox
   * first, so the change is only made once they are safe, and `run` then does them and removes each
   * row. If the process stops before `run`, the drain does them after a short grace. Throws, and
   * leaves nothing behind that matters, when the rows cannot be written.
   */
  async reserve(
    path: string,
    jobs: readonly SecurityEffectJob[],
  ): Promise<ReservedSecurityEffects> {
    const graceEnds = new Date(this.now().getTime() + RESERVATION_GRACE_MS);
    const reserved: { id: string; job: SecurityEffectJob }[] = [];
    for (const job of jobs) {
      const id = await this.repository.enqueue({
        job,
        error: "reserved",
        nextAttemptAt: graceEnds,
      });
      reserved.push({ id, job });
    }
    return {
      run: async () => {
        for (const { id, job } of reserved) {
          const context = { path, effect: job.kind, userId: job.userId };
          try {
            await runSecurityEffect(this.ports, job);
            await this.repository.complete(id);
          } catch (error) {
            this.log.error(
              { ...context, ...describeError(error), attempt: 1 },
              "auth_security_effect_failed",
            );
            const now = this.now();
            await this.repository
              .retryLater({
                id,
                attemptCount: 1,
                error: describeError(error).errorMessage,
                nextAttemptAt: new Date(now.getTime() + DURABLE_RETRY_DELAYS_MS[0]),
                now,
              })
              .catch((retryError: unknown) =>
                this.log.error(
                  { ...context, ...describeError(retryError) },
                  "auth_security_effect_not_durable",
                ),
              );
          }
        }
      },
    };
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
    const context = retryLogContext(job);
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

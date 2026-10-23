import type { EmailSender, SecurityNoticePublisher } from "@auction/auth";
import {
  EMAIL_CHANGE_TOKEN_TTL_SECONDS,
  createEmailChangeToken,
  verifyEmailChangeToken,
} from "../lib/email-change-token.js";
import {
  IdentityOperationError,
  type IdentityOperationsService,
} from "./identity-operations.service.js";

/** Which product's confirmation page the emailed links open. */
export type EmailChangeChannel = "account" | "bid";

export type EmailChangeFailure =
  | "subject_not_found"
  | "same_email"
  | "email_taken"
  | "none_in_progress"
  | "invalid_token"
  | "stale_flow"
  | "expired"
  | "channel_unavailable";

export type EmailChangeResult<T> = ({ ok: true } & T) | { ok: false; kind: EmailChangeFailure };

export type EmailChangeDeps = {
  operations: Pick<
    IdentityOperationsService,
    "readSubject" | "startEmailChange" | "cancelEmailChange" | "confirmEmailChange"
  >;
  email: EmailSender;
  /** Tells both inboxes once the address has switched. */
  notices: SecurityNoticePublisher;
  authSecret: string;
  /** Absolute confirmation page URL per channel; a missing channel cannot start a change. */
  confirmationPages: Partial<Record<EmailChangeChannel, string>>;
};

const KNOWN_FAILURES: ReadonlySet<string> = new Set<EmailChangeFailure>([
  "subject_not_found",
  "email_taken",
  "none_in_progress",
  "stale_flow",
  "expired",
]);

function asFailure(error: unknown): EmailChangeFailure | null {
  return error instanceof IdentityOperationError && KNOWN_FAILURES.has(error.code)
    ? (error.code as EmailChangeFailure)
    : null;
}

/**
 * Changing the address on a LAX identity. The old and the new inbox each get a link and the
 * address switches only after both are followed, so neither a stolen session nor a typo can
 * move an account to an address its owner does not control.
 *
 * This is the one implementation: LAX Account calls it through its issuer routes and LAX Bid
 * through the machine-authenticated internal route, each with its own confirmation page.
 * Step-up (a recent sign-in) is the caller's concern, not this service's.
 */
export class EmailChangeService {
  constructor(
    private readonly deps: EmailChangeDeps,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async start(
    subjectId: string,
    newEmail: string,
    channel: EmailChangeChannel,
  ): Promise<EmailChangeResult<{ pendingEmail: string }>> {
    const page = this.deps.confirmationPages[channel];
    if (!page) return { ok: false, kind: "channel_unavailable" };
    const subject = await this.deps.operations.readSubject(subjectId);
    if (!subject) return { ok: false, kind: "subject_not_found" };
    const target = newEmail.trim().toLowerCase();
    if (target === subject.email.trim().toLowerCase()) return { ok: false, kind: "same_email" };

    const expiresAt = new Date(this.now().getTime() + EMAIL_CHANGE_TOKEN_TTL_SECONDS * 1_000);
    try {
      await this.deps.operations.startEmailChange(subjectId, target, expiresAt);
    } catch (error) {
      const failure = asFailure(error);
      if (failure) return { ok: false, kind: failure };
      throw error;
    }

    for (const confirmFor of ["old", "new"] as const) {
      const token = createEmailChangeToken(
        { subjectId, oldEmail: subject.email, newEmail: target, confirmFor },
        this.deps.authSecret,
        this.now(),
      );
      await this.deps.email.enqueue({
        template: "change-email",
        to: confirmFor === "old" ? subject.email : target,
        userId: subjectId,
        category: "auth",
        vars: {
          confirmationUrl: `${page}?t=${encodeURIComponent(token)}`,
          oldEmail: subject.email,
          newEmail: target,
          userName: subject.name,
          recipient: confirmFor === "old" ? "current" : "new",
        },
      });
    }
    return { ok: true, pendingEmail: target };
  }

  async cancel(subjectId: string): Promise<EmailChangeResult<object>> {
    try {
      await this.deps.operations.cancelEmailChange(subjectId);
      return { ok: true };
    } catch (error) {
      const failure = asFailure(error);
      if (failure) return { ok: false, kind: failure };
      throw error;
    }
  }

  async confirm(
    token: string,
  ): Promise<
    EmailChangeResult<{ subjectId: string; completed: boolean; confirmedFor: "old" | "new" }>
  > {
    const payload = verifyEmailChangeToken(token, this.deps.authSecret, this.now());
    if (!payload) return { ok: false, kind: "invalid_token" };
    try {
      const completed = await this.deps.operations.confirmEmailChange({
        subjectId: payload.subjectId,
        oldEmail: payload.oldEmail,
        newEmail: payload.newEmail,
        confirmFor: payload.confirmFor,
      });
      if (completed) {
        // Both inboxes confirmed it, but the old one is told too: it is the one that could still
        // reveal a change the owner did not make.
        void this.deps.notices.notify({
          kind: "email_changed",
          userId: payload.subjectId,
          at: this.now(),
          previousEmail: payload.oldEmail,
          newEmail: payload.newEmail,
        });
      }
      return {
        ok: true,
        subjectId: payload.subjectId,
        completed,
        confirmedFor: payload.confirmFor,
      };
    } catch (error) {
      const failure = asFailure(error);
      if (failure) return { ok: false, kind: failure };
      throw error;
    }
  }
}

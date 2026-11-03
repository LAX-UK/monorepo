import type { EmailSender } from "@auction/auth";
import type { StaffEmailChangeFailure, StaffEmailChangeRequest } from "@auction/identity-contracts";
import {
  EMAIL_CHANGE_TOKEN_TTL_SECONDS,
  createEmailChangeToken,
} from "../lib/email-change-token.js";
import { formatLondonTime } from "./format-london-time.js";
import {
  IdentityOperationError,
  type IdentityOperationsService,
} from "./identity-operations.service.js";

export type StaffEmailChangeResult =
  | { ok: true; pendingEmail: string }
  | { ok: false; kind: StaffEmailChangeFailure };

export type StaffEmailChangeDeps = {
  operations: Pick<
    IdentityOperationsService,
    "readSubject" | "startStaffAssistedEmailChange" | "cancelEmailChange" | "revokeAllSessions"
  >;
  email: EmailSender;
  authSecret: string;
  /** LAX Account's page the new address's link opens; without it a change cannot be started. */
  confirmationPage: string | undefined;
  /** LAX Account's security page, linked from the notice to the old address. */
  secureAccountUrl: string;
  /** Identity's own record of who moved which account, and on what proof. */
  audit: (entry: Record<string, unknown>, message: string) => void;
};

const KNOWN_FAILURES: ReadonlySet<string> = new Set<StaffEmailChangeFailure>([
  "subject_not_found",
  "email_taken",
]);

/**
 * Moves an account to a new address for someone who can no longer open the old inbox.
 *
 * The old inbox cannot confirm, so staff vouch for it: they checked who is asking, and Bid has
 * already required a reason, a proof and a fresh sign-in. That is the only thing that differs
 * from a self-service change. The new address must still be confirmed by the person, so a typo
 * or a stranger's address never receives the account. The old address is told straight away,
 * every session is ended, and nothing changes until the new inbox's link is followed.
 */
export class StaffEmailChangeService {
  constructor(
    private readonly deps: StaffEmailChangeDeps,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async start(
    subjectId: string,
    request: StaffEmailChangeRequest,
  ): Promise<StaffEmailChangeResult> {
    const page = this.deps.confirmationPage;
    if (!page) return { ok: false, kind: "channel_unavailable" };
    const subject = await this.deps.operations.readSubject(subjectId);
    if (!subject) return { ok: false, kind: "subject_not_found" };
    const target = request.newEmail.trim().toLowerCase();
    if (target === subject.email.trim().toLowerCase()) return { ok: false, kind: "same_email" };

    const at = this.now();
    const expiresAt = new Date(at.getTime() + EMAIL_CHANGE_TOKEN_TTL_SECONDS * 1_000);
    try {
      await this.deps.operations.startStaffAssistedEmailChange(subjectId, target, expiresAt);
    } catch (error) {
      if (error instanceof IdentityOperationError && KNOWN_FAILURES.has(error.code)) {
        return { ok: false, kind: error.code as StaffEmailChangeFailure };
      }
      throw error;
    }

    try {
      // Signing out first means a stolen session cannot be used while the change is pending.
      await this.deps.operations.revokeAllSessions(subjectId);
      await this.sendNotices({ subjectId, subject, target, page, at });
    } catch (error) {
      // A half-started change must not linger, and neither inbox should hold a live link to it.
      await this.deps.operations.cancelEmailChange(subjectId).catch(() => undefined);
      throw error;
    }

    this.deps.audit(
      {
        subjectId,
        actorSubjectId: request.actorSubjectId,
        reason: request.reason,
        proof: request.proof,
      },
      "staff_assisted_email_change_started",
    );
    return { ok: true, pendingEmail: target };
  }

  private async sendNotices(input: {
    subjectId: string;
    subject: { email: string; name: string };
    target: string;
    page: string;
    at: Date;
  }): Promise<void> {
    const { subjectId, subject, target, page, at } = input;
    // The old address first: it is the one that can still stop a takeover.
    await this.deps.email.enqueue({
      template: "staff-email-change-notice",
      to: subject.email,
      userId: subjectId,
      category: "auth",
      vars: {
        userName: subject.name,
        newEmail: target,
        whenDisplay: formatLondonTime(at),
        deviceLabel: null,
        secureAccountUrl: this.deps.secureAccountUrl,
      },
    });
    const token = createEmailChangeToken(
      { subjectId, oldEmail: subject.email, newEmail: target, confirmFor: "new" },
      this.deps.authSecret,
      at,
    );
    await this.deps.email.enqueue({
      template: "staff-email-change-confirm",
      to: target,
      userId: subjectId,
      category: "auth",
      vars: {
        confirmationUrl: `${page}?t=${encodeURIComponent(token)}`,
        oldEmail: subject.email,
        newEmail: target,
        userName: subject.name,
        validForDays: Math.round(EMAIL_CHANGE_TOKEN_TTL_SECONDS / 86_400),
      },
    });
  }
}

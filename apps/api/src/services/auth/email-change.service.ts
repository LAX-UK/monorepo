import type { Database } from "@auction/db";
import type { IEmailService } from "@auction/email";
import type { RequestEmailChangeInput } from "@auction/validators";
import type { Env } from "../../env.js";
import { createEmailChangeToken, verifyEmailChangeToken } from "../../lib/email-change-token.js";
import { createAppLogger } from "../../lib/logger.js";
import type { IUserEmailChangeRepository } from "../../repositories/interfaces/user-email-change.repository.js";
import { EmailChangeConfirmError } from "../../repositories/user-email-change.types.js";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";
import type { SessionRevocationService } from "../session-revocation.service.js";
import type { UserService } from "../user.service.js";

export type EmailChangeDeps = {
  userService: Pick<UserService, "getById">;
  emailChange: IUserEmailChangeRepository;
  emailService: Pick<IEmailService, "enqueue">;
  env: Pick<Env, "BETTER_AUTH_SECRET" | "WEB_ORIGIN" | "LOG_LEVEL" | "NODE_ENV">;
  authDb: Database;
  sessionRevocation: SessionRevocationService;
};

export async function requestEmailChange(args: {
  deps: EmailChangeDeps;
  userId: string;
  body: RequestEmailChangeInput;
  authAudit?: IAuthAuditPublisher | undefined;
}): Promise<{ ok: true } | { ok: false; kind: "user_not_found" | "same_email" | "email_taken" }> {
  const { deps, userId, body, authAudit } = args;
  const current = await deps.userService.getById(userId);
  if (!current) return { ok: false, kind: "user_not_found" };

  const newEmailNorm = body.newEmail.trim().toLowerCase();
  const currentNorm = current.email.trim().toLowerCase();
  if (newEmailNorm === currentNorm) return { ok: false, kind: "same_email" };

  if (await deps.emailChange.isEmailTakenByOtherUser(newEmailNorm, userId)) {
    return { ok: false, kind: "email_taken" };
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await deps.emailChange.setPendingChange(userId, newEmailNorm, expiresAt);

  const ttlSeconds = 7 * 24 * 60 * 60;
  const tokenOld = createEmailChangeToken(
    { userId, oldEmail: current.email, newEmail: newEmailNorm, confirmFor: "old" },
    deps.env.BETTER_AUTH_SECRET,
    ttlSeconds,
  );
  const tokenNew = createEmailChangeToken(
    { userId, oldEmail: current.email, newEmail: newEmailNorm, confirmFor: "new" },
    deps.env.BETTER_AUTH_SECRET,
    ttlSeconds,
  );
  const base = `${deps.env.WEB_ORIGIN.replace(/\/$/, "")}/dashboard/settings/account/confirm`;
  const urlOld = `${base}?t=${encodeURIComponent(tokenOld)}`;
  const urlNew = `${base}?t=${encodeURIComponent(tokenNew)}`;

  await deps.emailService.enqueue({
    template: "change-email",
    to: current.email,
    userId,
    category: "auth",
    vars: {
      confirmationUrl: urlOld,
      oldEmail: current.email,
      newEmail: newEmailNorm,
      userName: current.name,
      recipient: "current",
    },
  });
  await deps.emailService.enqueue({
    template: "change-email",
    to: newEmailNorm,
    userId,
    category: "auth",
    vars: {
      confirmationUrl: urlNew,
      oldEmail: current.email,
      newEmail: newEmailNorm,
      userName: current.name,
      recipient: "new",
    },
  });

  void authAudit
    ?.publish({
      eventType: "auth.email_change_started",
      aggregateId: userId,
      payload: {},
      actorUserId: userId,
    })
    .catch(() => {});

  return { ok: true };
}

export async function clearEmailChangeInProgress(args: {
  deps: EmailChangeDeps;
  userId: string;
  authAudit?: IAuthAuditPublisher | undefined;
}): Promise<{ ok: true } | { ok: false; kind: "none_in_progress" }> {
  const { deps, userId, authAudit } = args;

  const pending = await deps.emailChange.getPendingNewEmail(userId);
  if (!pending) return { ok: false, kind: "none_in_progress" };

  await deps.emailChange.clearPendingChange(userId);

  void authAudit
    ?.publish({
      eventType: "auth.email_change_cancelled",
      aggregateId: userId,
      payload: {},
      actorUserId: userId,
    })
    .catch(() => {});

  return { ok: true };
}

export type ConfirmEmailChangeResult =
  | { ok: true; completed: true }
  | { ok: true; completed: false; confirmFor: "old" | "new" }
  | {
      ok: false;
      kind: "invalid_token" | "user_not_found" | "stale_flow" | "expired" | "email_taken";
    };

export async function confirmEmailChangeFromToken(args: {
  deps: EmailChangeDeps;
  token: string;
  authAudit?: IAuthAuditPublisher | undefined;
}): Promise<ConfirmEmailChangeResult> {
  const { deps, token, authAudit } = args;
  let payload: ReturnType<typeof verifyEmailChangeToken>;
  try {
    payload = verifyEmailChangeToken(token, deps.env.BETTER_AUTH_SECRET);
  } catch {
    return { ok: false, kind: "invalid_token" };
  }

  try {
    const completed = await deps.emailChange.confirmInAuthTransaction(deps.authDb, {
      userId: payload.userId,
      oldEmail: payload.oldEmail,
      newEmail: payload.newEmail,
      confirmFor: payload.confirmFor,
    });

    if (completed) {
      try {
        await deps.sessionRevocation.revokeAllForUser(payload.userId);
      } catch (revErr) {
        createAppLogger({
          LOG_LEVEL: deps.env.LOG_LEVEL ?? "info",
          NODE_ENV: deps.env.NODE_ENV ?? "production",
        }).error(
          { err: revErr instanceof Error ? revErr.message : String(revErr) },
          "email_change_revoke_sessions_failed",
        );
      }
      void authAudit
        ?.publish({
          eventType: "auth.email_change_completed",
          aggregateId: payload.userId,
          payload: {},
          actorUserId: payload.userId,
        })
        .catch(() => {});
      return { ok: true, completed: true };
    }
    return { ok: true, completed: false, confirmFor: payload.confirmFor };
  } catch (e) {
    if (e instanceof EmailChangeConfirmError) return { ok: false, kind: e.kind };
    return { ok: false, kind: "invalid_token" };
  }
}

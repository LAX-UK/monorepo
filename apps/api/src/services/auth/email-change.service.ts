import type { IEmailService } from "@auction/email";
import type { RequestEmailChangeInput } from "@auction/validators";
import type { Env } from "../../env.js";
import { IdentityIssuerClientError } from "../../infrastructure/http-identity-issuer.client.js";
import { createEmailChangeToken, verifyEmailChangeToken } from "../../lib/email-change-token.js";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";
import type { IIdentityEmailChangeClient } from "../interfaces/identity-issuer-client.js";
import type { UserService } from "../user.service.js";

export type EmailChangeDeps = {
  userService: Pick<UserService, "getById">;
  identityIssuer: IIdentityEmailChangeClient;
  emailService: Pick<IEmailService, "enqueue">;
  env: Pick<Env, "CHECK_IN_TOKEN_SECRET" | "WEB_ORIGIN" | "LOG_LEVEL" | "NODE_ENV">;
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

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  try {
    await deps.identityIssuer.startEmailChange({
      subjectId: userId,
      newEmail: newEmailNorm,
      expiresAt,
    });
  } catch (error) {
    if (error instanceof IdentityIssuerClientError && error.code === "email_taken") {
      return { ok: false, kind: "email_taken" };
    }
    if (error instanceof IdentityIssuerClientError && error.code === "subject_not_found") {
      return { ok: false, kind: "user_not_found" };
    }
    throw error;
  }

  const ttlSeconds = 7 * 24 * 60 * 60;
  const tokenOld = createEmailChangeToken(
    { userId, oldEmail: current.email, newEmail: newEmailNorm, confirmFor: "old" },
    deps.env.CHECK_IN_TOKEN_SECRET,
    ttlSeconds,
  );
  const tokenNew = createEmailChangeToken(
    { userId, oldEmail: current.email, newEmail: newEmailNorm, confirmFor: "new" },
    deps.env.CHECK_IN_TOKEN_SECRET,
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

  const pending = await deps.identityIssuer.pendingEmailChange(userId);
  if (!pending) return { ok: false, kind: "none_in_progress" };

  await deps.identityIssuer.cancelEmailChange(userId);

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
    payload = verifyEmailChangeToken(token, deps.env.CHECK_IN_TOKEN_SECRET);
  } catch {
    return { ok: false, kind: "invalid_token" };
  }

  try {
    const completed = await deps.identityIssuer.confirmEmailChange({
      subjectId: payload.userId,
      oldEmail: payload.oldEmail,
      newEmail: payload.newEmail,
      confirmFor: payload.confirmFor,
    });

    if (completed) {
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
    if (
      e instanceof IdentityIssuerClientError &&
      (e.code === "subject_not_found" ||
        e.code === "stale_flow" ||
        e.code === "expired" ||
        e.code === "email_taken")
    ) {
      return {
        ok: false,
        kind: e.code === "subject_not_found" ? "user_not_found" : e.code,
      };
    }
    return { ok: false, kind: "invalid_token" };
  }
}

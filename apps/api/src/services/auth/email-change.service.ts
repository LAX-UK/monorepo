import type { RequestEmailChangeInput } from "@auction/validators";
import { IdentityIssuerClientError } from "../../infrastructure/http-identity-issuer.client.js";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";
import type { IIdentityEmailChangeClient } from "../interfaces/identity-issuer-client.js";

/**
 * The email-change flow itself (tokens, the two confirmation emails and the switch) is owned by
 * the identity issuer, which LAX Account uses too. This module only adapts it to LAX Bid's
 * routes and records Bid's audit events.
 */
export type EmailChangeDeps = {
  identityIssuer: IIdentityEmailChangeClient;
};

type EmailChangeFailureKind = "user_not_found" | "same_email" | "email_taken";

function startFailure(error: unknown): EmailChangeFailureKind | null {
  if (!(error instanceof IdentityIssuerClientError)) return null;
  if (error.code === "email_taken" || error.code === "same_email") return error.code;
  return error.code === "subject_not_found" ? "user_not_found" : null;
}

export async function requestEmailChange(args: {
  deps: EmailChangeDeps;
  userId: string;
  body: RequestEmailChangeInput;
  authAudit?: IAuthAuditPublisher | undefined;
}): Promise<{ ok: true } | { ok: false; kind: EmailChangeFailureKind }> {
  const { deps, userId, body, authAudit } = args;
  try {
    await deps.identityIssuer.startEmailChange({ subjectId: userId, newEmail: body.newEmail });
  } catch (error) {
    const kind = startFailure(error);
    if (kind) return { ok: false, kind };
    throw error;
  }

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
  try {
    const confirmation = await deps.identityIssuer.confirmEmailChange({ token });
    if (confirmation.completed) {
      void authAudit
        ?.publish({
          eventType: "auth.email_change_completed",
          aggregateId: confirmation.subjectId,
          payload: {},
          actorUserId: confirmation.subjectId,
        })
        .catch(() => {});
      return { ok: true, completed: true };
    }
    return { ok: true, completed: false, confirmFor: confirmation.confirmedFor };
  } catch (e) {
    if (e instanceof IdentityIssuerClientError) {
      if (e.code === "subject_not_found") return { ok: false, kind: "user_not_found" };
      if (e.code === "stale_flow" || e.code === "expired" || e.code === "email_taken") {
        return { ok: false, kind: e.code };
      }
    }
    return { ok: false, kind: "invalid_token" };
  }
}

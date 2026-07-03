import { user } from "@auction/db/schema";
import type { RequestEmailChangeInput } from "@auction/validators";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Container } from "../../container.js";
import { createEmailChangeToken, verifyEmailChangeToken } from "../../lib/email-change-token.js";
import { createAppLogger } from "../../lib/logger.js";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";

export async function requestEmailChange(args: {
  container: Container;
  userId: string;
  body: RequestEmailChangeInput;
  authAudit?: IAuthAuditPublisher | undefined;
}): Promise<{ ok: true } | { ok: false; kind: "user_not_found" | "same_email" | "email_taken" }> {
  const { container, userId, body, authAudit } = args;
  const current = await container.userService.getById(userId);
  if (!current) return { ok: false, kind: "user_not_found" };

  const newEmailNorm = body.newEmail.trim().toLowerCase();
  const currentNorm = current.email.trim().toLowerCase();
  if (newEmailNorm === currentNorm) return { ok: false, kind: "same_email" };

  const [clash] = await container.db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${newEmailNorm}`)
    .limit(1);
  if (clash && clash.id !== userId) return { ok: false, kind: "email_taken" };

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await container.db
    .update(user)
    .set({
      pendingNewEmail: newEmailNorm,
      emailChangeOldOk: false,
      emailChangeNewOk: false,
      emailChangeExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  const ttlSeconds = 7 * 24 * 60 * 60;
  const tokenOld = createEmailChangeToken(
    { userId, oldEmail: current.email, newEmail: newEmailNorm, confirmFor: "old" },
    container.env.BETTER_AUTH_SECRET,
    ttlSeconds,
  );
  const tokenNew = createEmailChangeToken(
    { userId, oldEmail: current.email, newEmail: newEmailNorm, confirmFor: "new" },
    container.env.BETTER_AUTH_SECRET,
    ttlSeconds,
  );
  const base = `${container.env.WEB_ORIGIN.replace(/\/$/, "")}/dashboard/settings/account/confirm`;
  const urlOld = `${base}?t=${encodeURIComponent(tokenOld)}`;
  const urlNew = `${base}?t=${encodeURIComponent(tokenNew)}`;

  await container.emailService.enqueue({
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
  await container.emailService.enqueue({
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
  container: Container;
  userId: string;
  authAudit?: IAuthAuditPublisher | undefined;
}): Promise<{ ok: true } | { ok: false; kind: "none_in_progress" }> {
  const { container, userId, authAudit } = args;

  const [row] = await container.db
    .select({ pendingNewEmail: user.pendingNewEmail })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row?.pendingNewEmail) return { ok: false, kind: "none_in_progress" };

  await container.db
    .update(user)
    .set({
      pendingNewEmail: null,
      emailChangeOldOk: false,
      emailChangeNewOk: false,
      emailChangeExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

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
  container: Container;
  token: string;
  authAudit?: IAuthAuditPublisher | undefined;
}): Promise<ConfirmEmailChangeResult> {
  const { container, token, authAudit } = args;
  let payload: ReturnType<typeof verifyEmailChangeToken>;
  try {
    payload = verifyEmailChangeToken(token, container.env.BETTER_AUTH_SECRET);
  } catch {
    return { ok: false, kind: "invalid_token" };
  }

  try {
    const completed = await container.authDb.transaction(async (tx) => {
      const [row] = await tx.select().from(user).where(eq(user.id, payload.userId)).limit(1);
      if (!row) throw new Error("user_not_found");
      if (!row.pendingNewEmail || row.pendingNewEmail !== payload.newEmail) {
        throw new Error("stale_flow");
      }
      if (row.email !== payload.oldEmail) {
        throw new Error("stale_flow");
      }
      if (row.emailChangeExpiresAt && row.emailChangeExpiresAt.getTime() < Date.now()) {
        throw new Error("expired");
      }

      if (payload.confirmFor === "old") {
        await tx
          .update(user)
          .set({ emailChangeOldOk: true, updatedAt: new Date() })
          .where(eq(user.id, payload.userId));
      } else {
        await tx
          .update(user)
          .set({ emailChangeNewOk: true, updatedAt: new Date() })
          .where(eq(user.id, payload.userId));
      }

      const [fresh] = await tx.select().from(user).where(eq(user.id, payload.userId)).limit(1);
      if (!fresh?.pendingNewEmail) return false;
      if (!fresh.emailChangeOldOk || !fresh.emailChangeNewOk) return false;

      const [other] = await tx
        .select({ id: user.id })
        .from(user)
        .where(
          and(sql`lower(${user.email}) = ${fresh.pendingNewEmail}`, ne(user.id, payload.userId)),
        )
        .limit(1);
      if (other) throw new Error("email_taken");

      await tx
        .update(user)
        .set({
          email: fresh.pendingNewEmail,
          emailVerified: true,
          emailStatus: "ok",
          emailStatusChangedAt: new Date(),
          pendingNewEmail: null,
          emailChangeOldOk: false,
          emailChangeNewOk: false,
          emailChangeExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, payload.userId));
      return true;
    });

    if (completed) {
      try {
        await container.sessionRevocation.revokeAllForUser(payload.userId);
      } catch (revErr) {
        createAppLogger({
          LOG_LEVEL: container.env.LOG_LEVEL ?? "info",
          NODE_ENV: container.env.NODE_ENV ?? "production",
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
    const msg = e instanceof Error ? e.message : "";
    if (msg === "user_not_found") return { ok: false, kind: "user_not_found" };
    if (msg === "stale_flow") return { ok: false, kind: "stale_flow" };
    if (msg === "expired") return { ok: false, kind: "expired" };
    if (msg === "email_taken") return { ok: false, kind: "email_taken" };
    return { ok: false, kind: "invalid_token" };
  }
}

import { user } from "@auction/db/schema";
import { forgotPasswordBodySchema, requestEmailChangeSchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { and, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { createEmailChangeToken, verifyEmailChangeToken } from "../lib/email-change-token.js";

export function createAuthRoutes(container: Container) {
  const r = new Hono();
  r.post("/forgot-password", zValidator("json", forgotPasswordBodySchema), async (c) => {
    const body = c.req.valid("json");
    await container.auth.api.requestPasswordReset({
      body: {
        email: body.email,
        redirectTo: `${container.env.WEB_ORIGIN.replace(/\/$/, "")}/reset-password`,
      },
    });
    return c.json({ ok: true });
  });
  r.post("/change-email", zValidator("json", requestEmailChangeSchema), async (c) => {
    const session = await container.auth.api.getSession({ headers: c.req.raw.headers });
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = c.req.valid("json");
    const current = await container.userService.getById(userId);
    if (!current) return c.json({ error: "User not found" }, 404);

    const newEmailNorm = body.newEmail.trim().toLowerCase();
    const currentNorm = current.email.trim().toLowerCase();
    if (newEmailNorm === currentNorm) {
      return c.json({ error: "New email must differ from your current address" }, 400);
    }

    const [clash] = await container.db
      .select({ id: user.id })
      .from(user)
      .where(sql`lower(${user.email}) = ${newEmailNorm}`)
      .limit(1);
    if (clash && clash.id !== userId) {
      return c.json({ error: "That email is already in use" }, 409);
    }

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
    return c.json({ ok: true });
  });

  /** Clear an in-flight dual-confirm email change (typo recovery, user gave up). */
  r.delete("/change-email", async (c) => {
    const session = await container.auth.api.getSession({ headers: c.req.raw.headers });
    const userId = session?.user?.id;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const [row] = await container.db
      .select({ pendingNewEmail: user.pendingNewEmail })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!row?.pendingNewEmail) {
      return c.json({ error: "No email change is in progress" }, 400);
    }

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
    return c.json({ ok: true });
  });

  r.post("/confirm-email-change", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { token?: unknown };
    if (typeof body.token !== "string") return c.json({ error: "Missing token" }, 400);
    try {
      const payload = verifyEmailChangeToken(body.token, container.env.BETTER_AUTH_SECRET);

      const completed = await container.db.transaction(async (tx) => {
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
        return c.json({ ok: true, completed: true });
      }
      return c.json({
        ok: true,
        completed: false,
        message:
          payload.confirmFor === "old"
            ? "Current address confirmed. Open the email sent to your new address and confirm there to finish."
            : "New address confirmed. Open the email sent to your current address and confirm there to finish.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "user_not_found") return c.json({ error: "User not found" }, 404);
      if (msg === "stale_flow") {
        return c.json({ error: "Email change token no longer matches this account" }, 409);
      }
      if (msg === "expired") {
        return c.json(
          { error: "This email change request has expired. Start again from settings." },
          410,
        );
      }
      if (msg === "email_taken") {
        return c.json({ error: "That email is already in use" }, 409);
      }
      return c.json({ error: "Invalid or expired token" }, 400);
    }
  });
  return r;
}

import { user } from "@auction/db/schema";
import { forgotPasswordBodySchema, requestEmailChangeSchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
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

    const token = createEmailChangeToken(
      { userId, oldEmail: current.email, newEmail: body.newEmail },
      container.env.BETTER_AUTH_SECRET,
    );
    const confirmationUrl = `${container.env.WEB_ORIGIN.replace(/\/$/, "")}/dashboard/settings/account/confirm?t=${encodeURIComponent(token)}`;
    await container.emailService.enqueue({
      template: "change-email",
      to: current.email,
      userId,
      category: "auth",
      vars: {
        confirmationUrl,
        oldEmail: current.email,
        newEmail: body.newEmail,
        userName: current.name,
      },
    });
    return c.json({ ok: true });
  });

  r.post("/confirm-email-change", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { token?: unknown };
    if (typeof body.token !== "string") return c.json({ error: "Missing token" }, 400);
    try {
      const payload = verifyEmailChangeToken(body.token, container.env.BETTER_AUTH_SECRET);
      const current = await container.userService.getById(payload.userId);
      if (!current || current.email !== payload.oldEmail) {
        return c.json({ error: "Email change token no longer matches this account" }, 409);
      }
      await container.db
        .update(user)
        .set({
          email: payload.newEmail,
          emailVerified: true,
          emailStatus: "ok",
          emailStatusChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(user.id, payload.userId));
      return c.json({ ok: true });
    } catch {
      return c.json({ error: "Invalid or expired token" }, 400);
    }
  });
  return r;
}

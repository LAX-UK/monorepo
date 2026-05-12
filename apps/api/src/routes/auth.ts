import { account, user } from "@auction/db/schema";
import {
  forgotPasswordBodySchema,
  requestEmailChangeSchema,
  setupPasswordBodySchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { and, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { createEmailChangeToken, verifyEmailChangeToken } from "../lib/email-change-token.js";
import {
  createForgotPasswordRateLimitMiddleware,
  createSetupPasswordRateLimitMiddleware,
} from "../middleware/auth-rate-limit.js";

/** Providers we render "Sign in with X" copy for in the OAuth-only reset
 * email. Other providerIds (e.g. `credential`, future Microsoft) fall back
 * to the generic message rendered by the template.
 */
const SUPPORTED_SOCIAL_PROVIDERS = new Set(["google", "apple"]);

/** Side-effects for `POST /auth/forgot-password`, executed off the
 * response path so the request returns at near-constant time regardless of
 * whether the email is registered or which providers it uses.
 */
async function runForgotPasswordSideEffects(args: {
  email: string;
  webOrigin: string;
  container: Container;
}): Promise<void> {
  const { email, webOrigin, container } = args;
  const [found] = await container.db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`)
    .limit(1);
  if (!found) return;

  const linked = await container.db
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, found.id));

  const hasCredential = linked.some((a) => a.providerId === "credential");
  const social = linked.find((a) => SUPPORTED_SOCIAL_PROVIDERS.has(a.providerId));

  if (hasCredential) {
    await container.auth.api.requestPasswordReset({
      body: { email: found.email, redirectTo: `${webOrigin}/reset-password` },
    });
    return;
  }

  if (social && (social.providerId === "google" || social.providerId === "apple")) {
    await container.emailService.enqueue({
      template: "oauth-account-reset-attempt",
      to: found.email,
      userId: found.id,
      category: "auth",
      vars: {
        provider: social.providerId,
        signInUrl: `${webOrigin}/login`,
        settingsUrl: `${webOrigin}/dashboard/settings?tab=security`,
        userEmail: found.email,
        userName: found.name,
      },
    });
  }
}

export function createAuthRoutes(container: Container) {
  const r = new Hono();

  r.post(
    "/forgot-password",
    createForgotPasswordRateLimitMiddleware(container.redis),
    zValidator("json", forgotPasswordBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      const email = body.email.trim().toLowerCase();
      const webOrigin = container.env.WEB_ORIGIN.replace(/\/$/, "");

      // SECURITY: every branch (unknown email, credential user, oauth-only
      // user) must return the identical {ok:true} response to prevent email
      // enumeration. Side-effects are dispatched fire-and-forget so the
      // response latency is also roughly equal across branches (a timing
      // attacker cannot tell the lookup outcome from the response time
      // alone). Errors thrown inside the background task are swallowed for
      // the same reason.
      void runForgotPasswordSideEffects({ email, webOrigin, container }).catch(() => undefined);

      return c.json({ ok: true });
    },
  );

  r.post(
    "/setup-password",
    createSetupPasswordRateLimitMiddleware(container.redis),
    zValidator("json", setupPasswordBodySchema),
    async (c) => {
      const session = await container.auth.api.getSession({ headers: c.req.raw.headers });
      const userId = session?.user?.id;
      if (!userId) return c.json({ error: "Unauthorized" }, 401);

      const current = await container.userService.getById(userId);
      if (!current) return c.json({ error: "User not found" }, 404);

      const { password } = c.req.valid("json");
      const auth = container.auth as unknown as {
        $context: Promise<{ password: { hash: (pw: string) => Promise<string> } }>;
      };
      const ctx = await auth.$context;
      const hash = await ctx.password.hash(password);

      // SECURITY: the check + insert must run in a single transaction.
      // Without it, two concurrent submissions can both observe "no
      // credential row" and both insert one. There is no DB-level unique
      // constraint on (user_id, provider_id) today (see
      // packages/db/src/schema/auth.ts), so the transaction is the only
      // line of defence against that race.
      let alreadySet = false;
      try {
        await container.db.transaction(async (tx) => {
          const existing = await tx
            .select({ id: account.id })
            .from(account)
            .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
            .limit(1);
          if (existing.length > 0) {
            alreadySet = true;
            return;
          }
          const now = new Date();
          await tx.insert(account).values({
            id: crypto.randomUUID(),
            accountId: userId,
            providerId: "credential",
            userId,
            password: hash,
            createdAt: now,
            updatedAt: now,
          });
        });
      } catch (e) {
        return c.json({ error: e instanceof Error ? e.message : "Could not set password." }, 500);
      }

      if (alreadySet) {
        return c.json({ error: "A password is already set on this account." }, 409);
      }

      void container.emailService.enqueue({
        template: "password-changed",
        to: current.email,
        userId,
        category: "auth",
        vars: { userName: current.name },
      });

      return c.json({ ok: true });
    },
  );
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

      // Use authDb (auth_app role): the final commit step writes `email` and
      // `email_verified`, which `api_app` is intentionally NOT granted UPDATE on
      // (see packages/db/src/migrate-roles.ts). Running the whole transaction
      // on authDb keeps the validate-then-commit atomic.
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

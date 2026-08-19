import { IDENTITY_EMAIL_TEMPLATE_NAMES } from "@auction/auth";
import type { EmailEnqueueInput } from "@auction/email";
import { Sentry } from "@auction/observability";
import { Hono } from "hono";
import { z } from "zod";
import type { ContainerInternalIdentityEmailRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { timingSafeSecretMatches } from "../lib/internal-cron-auth.js";

const identityEmailInputSchema = z
  .object({
    template: z.enum(IDENTITY_EMAIL_TEMPLATE_NAMES),
    to: z.string().email(),
    userId: z.string().min(1).optional(),
    vars: z.record(z.unknown()),
    stream: z.enum(["transactional", "broadcast"]).optional(),
    idempotencyKey: z.string().min(1).optional(),
    category: z.enum(["auth", "transactional"]),
  })
  .strict();

export function createInternalIdentityEmailRoutes(
  container: ContainerInternalIdentityEmailRoutesSlice,
  env: Pick<Env, "IDENTITY_MACHINE_CLIENT_ID" | "IDENTITY_MACHINE_CLIENT_SECRET">,
) {
  const routes = new Hono();

  routes.post("/emails", async (c) => {
    if (!env.IDENTITY_MACHINE_CLIENT_ID || !env.IDENTITY_MACHINE_CLIENT_SECRET) {
      return c.json({ error: "identity_email_not_configured" }, 503);
    }
    const clientId = c.req.header("x-identity-client-id");
    const clientSecret = c.req.header("x-identity-client-secret");
    if (
      !timingSafeSecretMatches(clientId, env.IDENTITY_MACHINE_CLIENT_ID) ||
      !timingSafeSecretMatches(clientSecret, env.IDENTITY_MACHINE_CLIENT_SECRET)
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const payload = await c.req.json().catch(() => null);
    const parsed = identityEmailInputSchema.safeParse(payload);
    if (!parsed.success) {
      return c.json({ error: "invalid_identity_email" }, 400);
    }

    try {
      const result = await container.emailService.enqueue({
        template: parsed.data.template,
        to: parsed.data.to,
        vars: parsed.data.vars,
        category: parsed.data.category,
        ...(parsed.data.userId ? { userId: parsed.data.userId } : {}),
        ...(parsed.data.stream ? { stream: parsed.data.stream } : {}),
        ...(parsed.data.idempotencyKey ? { idempotencyKey: parsed.data.idempotencyKey } : {}),
        recipientResolution: "snapshot",
      } satisfies EmailEnqueueInput);
      return c.json({ data: result }, 201);
    } catch (error) {
      Sentry.captureException(error);
      return c.json({ error: "identity_email_enqueue_unavailable" }, 503);
    }
  });

  return routes;
}

import { forgotPasswordBodySchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";

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
  return r;
}

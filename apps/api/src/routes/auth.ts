import { forgotPasswordBodySchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";

/** Stub auth endpoints (no real email dispatch yet). */
export function createAuthRoutes(_container: Container) {
  const r = new Hono();
  r.post("/forgot-password", zValidator("json", forgotPasswordBodySchema), async (c) => {
    const { email } = c.req.valid("json");
    // Stub: always succeed to avoid user enumeration; replace with real mailer later.
    console.info("[auth] forgot-password requested", { email });
    return c.json({ ok: true });
  });
  return r;
}

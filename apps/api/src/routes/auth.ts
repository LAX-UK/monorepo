import { forgotPasswordBodySchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";

/** Stub auth endpoints (no real email dispatch yet). */
export function createAuthRoutes(_container: Container) {
  const r = new Hono();
  r.post("/forgot-password", zValidator("json", forgotPasswordBodySchema), async (c) => {
    // Stub: always succeed to avoid user enumeration; replace with real mailer later.
    // Do not log raw email (PII).
    return c.json({ ok: true });
  });
  return r;
}

import type { Hono } from "hono";

/** RP completion hook for FedCM tokens (Chromium, flag-gated). */
export function registerFedcmCompleteRoutes(app: Hono, enabled: boolean): void {
  if (!enabled) return;

  app.post("/fedcm/complete", async (c) => {
    return c.json({ error: "not_implemented" }, 501);
  });
}

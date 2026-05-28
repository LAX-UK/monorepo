import { xeroOAuthCompleteBodySchema } from "@auction/validators";
import type { Hono } from "hono";
import { zValidator } from "../lib/z-validator.js";
import type { AdminRouteServices } from "../services/interfaces/admin-routes.js";

export function attachXeroAdminRoutes(
  r: Hono<{ Variables: { userId?: string; userRole?: string } }>,
  admin: AdminRouteServices,
): void {
  const xero = admin.xero;

  r.get("/integrations/xero/status", async (c) => {
    const data = await xero.getStatusPayload();
    return c.json({ data });
  });

  r.get("/integrations/xero/oauth/consent-url", async (c) => {
    const userId = c.get("userId") as string;
    const built = await xero.buildConsentUrl(userId);
    if (!built.ok) {
      return c.json({ error: built.error }, 503);
    }
    return c.json({ data: { url: built.url } });
  });

  r.post(
    "/integrations/xero/oauth/complete",
    zValidator("json", xeroOAuthCompleteBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const result = await xero.completeOAuth({
        userId,
        state: body.state,
        callbackFullUrl: body.callbackUrl,
      });
      if (!result.ok) {
        return c.json({ error: result.message }, 400);
      }
      return c.json({ ok: true });
    },
  );

  r.post("/integrations/xero/disconnect", async (c) => {
    const out = await xero.disconnect();
    if (!out.ok) {
      return c.json({ error: out.error }, 503);
    }
    return c.json({ ok: true });
  });
}

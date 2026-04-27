import { isXeroCallbackUrlAllowed, xeroOAuthCompleteBodySchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import type { Container } from "../container.js";

export function attachXeroAdminRoutes(
  r: Hono<{ Variables: { userId?: string; userRole?: string } }>,
  container: Container,
): void {
  const xeroOAuth = container.xeroOAuthService;

  r.get("/integrations/xero/status", async (c) => {
    if (!xeroOAuth) {
      return c.json({
        data: {
          connected: false,
          tenantId: null,
          tenantName: null,
          expiresAt: null,
          oauthConfigured: false,
        },
      });
    }
    const data = await xeroOAuth.getConnectionSummary();
    return c.json({ data: { ...data, oauthConfigured: true } });
  });

  if (!xeroOAuth) {
    return;
  }

  r.get("/integrations/xero/oauth/consent-url", async (c) => {
    const userId = c.get("userId") as string;
    const url = await xeroOAuth.buildConsentUrlForUser(userId);
    return c.json({ data: { url } });
  });

  r.post(
    "/integrations/xero/oauth/complete",
    zValidator("json", xeroOAuthCompleteBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const allowed = container.env.XERO_REDIRECT_URI;
      if (!allowed || !isXeroCallbackUrlAllowed(body.callbackUrl, allowed)) {
        return c.json({ error: "Invalid callback URL" }, 400);
      }
      const result = await xeroOAuth.completeOAuth({
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
    await xeroOAuth.disconnect();
    return c.json({ ok: true });
  });
}

import { visitorAlertSignupSchema, visitorAlertTokenSchema } from "@auction/validators";
import { type Context, Hono } from "hono";
import type { ContainerSaleAlertRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

/**
 * Email alerts for new sales, for people without an account (double opt-in), and the signed-in
 * client's view of the same list in settings.
 */
export function createSaleAlertRoutes(
  container: ContainerSaleAlertRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const service = () => container.visitorSaleAlertService;
  const r = new Hono<{ Variables: { userId?: string } }>();

  // The answer is the same whether or not the address is already on the list.
  r.post("/subscribe", zValidator("json", visitorAlertSignupSchema), async (c) => {
    const { email, source } = c.req.valid("json");
    await service().subscribe({ email, source: source ?? "web_home_alerts" });
    return c.json({ ok: true });
  });

  r.post("/confirm", zValidator("json", visitorAlertTokenSchema), async (c) => {
    const { token } = c.req.valid("json");
    return c.json({ ok: true, outcome: await service().confirm(token) });
  });

  r.get("/unsubscribe/preview", async (c) => {
    const token = c.req.query("t");
    const preview = token ? await service().unsubscribePreview(token) : null;
    if (!preview) return c.json({ ok: false, error: "Invalid unsubscribe link" }, 400);
    return c.json({ ok: true, data: preview });
  });

  // A mail client's one-click unsubscribe posts here with the token in the query.
  r.post("/unsubscribe", async (c) => {
    const token = await tokenFromRequest(c);
    if (!token || !(await service().unsubscribe(token))) {
      return c.json({ ok: false, error: "Invalid unsubscribe link" }, 400);
    }
    return c.json({ ok: true });
  });

  r.get("/me", requireAuth, async (c) => {
    const state = await service().settingsState(c.get("userId") as string);
    return c.json({ data: { state } });
  });

  r.post("/me/link", requireAuth, async (c) => {
    const linked = await service().linkToClient(c.get("userId") as string);
    return linked ? c.json({ ok: true }) : c.json({ ok: false, error: "Nothing to link" }, 409);
  });

  r.delete("/me", requireAuth, async (c) => {
    await service().stopForClient(c.get("userId") as string);
    return c.body(null, 204);
  });

  return r;
}

async function tokenFromRequest(c: Context): Promise<string | null> {
  const queryToken = c.req.query("t");
  if (queryToken) return queryToken;
  const body = (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
  return typeof body.t === "string" ? body.t : null;
}

import { type Context, Hono } from "hono";
import type { ContainerAlertRoutesSlice } from "../container.js";

/**
 * The first sale-alerts routes, kept as aliases for 90 days: confirmation and stop links in emails
 * already sent point at them, and mail apps POST a one-click unsubscribe to them. Each answer
 * says when the route goes. They do exactly what the routes that replace them do.
 */
export function createLegacySaleAlertRoutes(container: ContainerAlertRoutesSlice) {
  const engine = () => container.alertEngine;
  const r = new Hono();

  r.use("*", async (c, next) => {
    await next();
    c.header("Deprecation", "true");
    c.header("Sunset", engine().legacyUntil.toUTCString());
  });

  r.post("/subscribe", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { email?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email : "";
    if (email.includes("@")) {
      await engine().subscribe.requestAsVisitor({
        product: "bid",
        topic: "bid.new_sales",
        email,
        source: "web_home_alerts",
      });
    }
    return c.json({ ok: true });
  });

  r.post("/confirm", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { token?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token : "";
    const outcome = token ? await engine().confirm.confirm(token, "bid") : "invalid";
    return c.json({ ok: true, outcome: outcome === "already_confirmed" ? "confirmed" : outcome });
  });

  r.get("/unsubscribe/preview", async (c) => {
    const token = c.req.query("t") ?? "";
    const preview = token ? await engine().stop.preview(token, "bid") : null;
    if (!preview || preview.state === "invalid") {
      return c.json({ ok: false, error: "Invalid unsubscribe link" }, 400);
    }
    return c.json({ ok: true, data: { email: preview.maskedEmail } });
  });

  // A mail client's one-click unsubscribe posts here with the token in the query.
  r.post("/unsubscribe", async (c) => {
    const token = await tokenFromRequest(c);
    const outcome = token ? await engine().stop.stopOneClick(token, "bid") : "invalid";
    if (outcome === "invalid") return c.json({ ok: false, error: "Invalid unsubscribe link" }, 400);
    return c.json({ ok: true });
  });

  return r;
}

async function tokenFromRequest(c: Context): Promise<string | null> {
  const queryToken = c.req.query("t");
  if (queryToken) return queryToken;
  const body = (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
  return typeof body.t === "string" ? body.t : null;
}

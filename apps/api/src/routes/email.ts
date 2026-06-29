import { type Context, Hono } from "hono";
import type { Container } from "../container.js";
import { verifyUnsubscribeToken } from "../lib/email-unsubscribe-token.js";

export function createEmailRoutes(container: Container) {
  const r = new Hono();

  r.get("/unsubscribe", async (c) => {
    const token = c.req.query("t");
    if (!token) return c.text("Missing unsubscribe token", 400);
    try {
      const payload = verifyUnsubscribeToken(token, container.env.EMAIL_UNSUBSCRIBE_SECRET);
      if (payload.scope === "type") {
        return c.html(
          `<p>You are unsubscribing from ${escapeHtml(payload.notificationType)} notifications.</p><form method="post"><input type="hidden" name="t" value="${escapeHtml(token)}"><button type="submit">Confirm unsubscribe</button></form>`,
        );
      }
      return c.html(
        `<p>You are unsubscribing from all non-essential email.</p><form method="post"><input type="hidden" name="t" value="${escapeHtml(token)}"><button type="submit">Confirm unsubscribe</button></form>`,
      );
    } catch {
      return c.text("Invalid unsubscribe token", 400);
    }
  });

  r.get("/unsubscribe/preview", async (c) => {
    const token = c.req.query("t");
    if (!token) return c.json({ ok: false, error: "Missing unsubscribe token" }, 400);
    try {
      const payload = verifyUnsubscribeToken(token, container.env.EMAIL_UNSUBSCRIBE_SECRET);
      const user = await container.userService.getById(payload.userId);
      if (!user) return c.json({ ok: false, error: "User not found" }, 404);
      return c.json({
        ok: true,
        data: {
          scope: payload.scope,
          notificationType: payload.scope === "type" ? payload.notificationType : null,
          email: user.email,
        },
      });
    } catch {
      return c.json({ ok: false, error: "Invalid unsubscribe token" }, 400);
    }
  });

  r.post("/unsubscribe", async (c) => {
    const token = await tokenFromRequest(c);
    if (!token) return c.json({ ok: false, error: "Missing unsubscribe token" }, 400);
    try {
      await container.emailUnsubscribeService.applyToken(token);
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false, error: "Invalid unsubscribe token" }, 400);
    }
  });

  return r;
}

async function tokenFromRequest(c: Context): Promise<string | null> {
  const queryToken = c.req.query("t");
  if (queryToken) return queryToken;
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await c.req.json().catch(() => ({}))) as { t?: unknown; token?: unknown };
    return typeof body.t === "string" ? body.t : typeof body.token === "string" ? body.token : null;
  }
  const body = (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
  const formToken = body.t ?? body.token;
  return typeof formToken === "string" ? formToken : null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

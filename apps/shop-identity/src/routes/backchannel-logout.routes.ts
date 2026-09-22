import type { Hono } from "hono";
import type { LogoutToken, ShopSessionRepository } from "../session.js";

type BackchannelLogoutRoutesDeps = {
  verifyLogoutToken(token: string): Promise<LogoutToken | null>;
  sessions: Pick<ShopSessionRepository, "consumeLogoutToken">;
};

export function registerBackchannelLogoutRoutes(
  app: Hono,
  deps: BackchannelLogoutRoutesDeps,
): void {
  app.post("/api/auth/backchannel-logout", async (c) => {
    if (!(c.req.header("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const params = new URLSearchParams(await c.req.text());
    if (params.getAll("logout_token").length !== 1) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const token = params.get("logout_token");
    if (!token) return c.json({ error: "invalid_request" }, 400);
    const claims = await deps.verifyLogoutToken(token);
    if (!claims) return c.json({ error: "invalid_logout_token" }, 400);
    const consumed = await deps.sessions.consumeLogoutToken(claims);
    if (consumed === "replay") return c.json({ error: "logout_token_replay" }, 400);
    return c.body(null, 200);
  });
}

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { LogoutToken, ShopSessionRepository } from "../session.js";
import { registerBackchannelLogoutRoutes } from "./backchannel-logout.routes.js";

const claims: LogoutToken = {
  jti: "logout-1",
  sid: "provider-session",
  expiresAt: new Date(Date.now() + 60_000),
};

function createApp(input?: {
  verified?: LogoutToken | null;
  consumed?: "consumed" | "replay";
}) {
  const app = new Hono();
  const consumeLogoutToken = vi.fn(async () => input?.consumed ?? ("consumed" as const));
  registerBackchannelLogoutRoutes(app, {
    verifyLogoutToken: vi.fn(async () =>
      input && "verified" in input ? (input.verified ?? null) : claims,
    ),
    sessions: {
      consumeLogoutToken,
    } as Pick<ShopSessionRepository, "consumeLogoutToken">,
  });
  return { app, consumeLogoutToken };
}

describe("backchannel logout route", () => {
  it("rejects malformed and unverifiable logout requests", async () => {
    const { app } = createApp({ verified: null });

    const wrongMedia = await app.request("/api/auth/backchannel-logout", {
      method: "POST",
      body: "logout_token=token",
    });
    expect(wrongMedia.status).toBe(400);
    const invalidToken = await app.request("/api/auth/backchannel-logout", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "logout_token=token",
    });
    expect(invalidToken.status).toBe(400);
    await expect(invalidToken.json()).resolves.toEqual({
      error: "invalid_logout_token",
    });
  });

  it("rejects replays and consumes a valid logout token once", async () => {
    const replay = createApp({ consumed: "replay" });
    const replayResponse = await replay.app.request("/api/auth/backchannel-logout", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "logout_token=token",
    });
    expect(replayResponse.status).toBe(400);
    await expect(replayResponse.json()).resolves.toEqual({
      error: "logout_token_replay",
    });

    const valid = createApp();
    const response = await valid.app.request("/api/auth/backchannel-logout", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "logout_token=token",
    });
    expect(response.status).toBe(200);
    expect(valid.consumeLogoutToken).toHaveBeenCalledWith(claims);
  });
});

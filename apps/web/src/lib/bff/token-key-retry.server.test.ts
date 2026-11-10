import { describe, expect, it, vi } from "vitest";
import {
  TokenRefreshFailedError,
  isTokenKeyUnknownRejection,
  sendWithKeyRetry,
} from "./token-key-retry.server";

const keyUnknown = () =>
  Response.json({ error: "Unauthorized", code: "token_key_unknown" }, { status: 401 });

describe("isTokenKeyUnknownRejection", () => {
  it("accepts only a 401 JSON envelope with the unknown-key code, and leaves the body readable", async () => {
    const response = keyUnknown();
    await expect(isTokenKeyUnknownRejection(response)).resolves.toBe(true);
    await expect(response.json()).resolves.toMatchObject({ code: "token_key_unknown" });
  });

  it.each([
    ["bare 401", new Response(null, { status: 401 })],
    ["session_required", Response.json({ code: "session_required" }, { status: 401 })],
    ["code on a 403", Response.json({ code: "token_key_unknown" }, { status: 403 })],
    ["code on a 200", Response.json({ code: "token_key_unknown" })],
    ["non-JSON body", new Response("token_key_unknown", { status: 401 })],
    [
      "malformed JSON",
      new Response("{", { status: 401, headers: { "content-type": "application/json" } }),
    ],
  ])("rejects %s", async (_n, response) => {
    await expect(isTokenKeyUnknownRejection(response)).resolves.toBe(false);
  });
});

describe("sendWithKeyRetry", () => {
  it("refreshes and sends once more on the unknown-key signal", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(keyUnknown())
      .mockResolvedValueOnce(Response.json({}));
    const refresh = vi.fn().mockResolvedValue({ token: "fresh" });
    const out = await sendWithKeyRetry({ resource: { token: "stale" }, refresh, send });
    expect(send.mock.calls.map((c) => c[0])).toEqual(["stale", "fresh"]);
    expect(refresh).toHaveBeenCalledOnce();
    expect(out.resource).toEqual({ token: "fresh" });
    expect(out.response.status).toBe(200);
  });

  it("does not refresh on other 401s or successes", async () => {
    for (const first of [new Response(null, { status: 401 }), Response.json({})]) {
      const send = vi.fn().mockResolvedValue(first);
      const refresh = vi.fn();
      const out = await sendWithKeyRetry({ resource: { token: "t" }, refresh, send });
      expect(send).toHaveBeenCalledOnce();
      expect(refresh).not.toHaveBeenCalled();
      expect(out.resource).toEqual({ token: "t" });
    }
  });

  it("never loops: a second unknown-key answer is returned as is", async () => {
    const send = vi.fn(async () => keyUnknown());
    const refresh = vi.fn().mockResolvedValue({ token: "fresh" });
    const out = await sendWithKeyRetry({ resource: { token: "stale" }, refresh, send });
    expect(send).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
    expect(out.response.status).toBe(401);
  });

  it("does nothing for a request that carries no token", async () => {
    const send = vi.fn(async () => keyUnknown());
    const refresh = vi.fn();
    await sendWithKeyRetry({ resource: null, refresh, send });
    expect(send).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("wraps a failed exchange without sending again", async () => {
    const send = vi.fn(async () => keyUnknown());
    const boom = new Error("issuer down");
    const refresh = vi.fn().mockRejectedValue(boom);
    const error = await sendWithKeyRetry({ resource: { token: "s" }, refresh, send }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(TokenRefreshFailedError);
    expect(error.cause).toBe(boom);
    expect(send).toHaveBeenCalledOnce();
  });
});

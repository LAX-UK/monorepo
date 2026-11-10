import { describe, expect, it, vi } from "vitest";
import { isReplaceableTokenRejection, sendWithKeyRetry } from "./token-key-retry.server";

const rejected = (code: string) => Response.json({ error: "Unauthorized", code }, { status: 401 });
const keyUnknown = () => rejected("token_key_unknown");

describe("isReplaceableTokenRejection", () => {
  it.each(["token_key_unknown", "token_expired"])(
    "accepts a 401 JSON envelope with %s and leaves the body readable",
    async (code) => {
      const response = rejected(code);
      await expect(isReplaceableTokenRejection(response)).resolves.toBe(true);
      await expect(response.json()).resolves.toMatchObject({ code });
    },
  );

  it.each([
    ["bare 401", new Response(null, { status: 401 })],
    ["session_required", rejected("session_required")],
    ["code on a 403", Response.json({ code: "token_key_unknown" }, { status: 403 })],
    ["code on a 200", Response.json({ code: "token_key_unknown" })],
    ["non-JSON body", new Response("token_key_unknown", { status: 401 })],
    [
      "malformed JSON",
      new Response("{", { status: 401, headers: { "content-type": "application/json" } }),
    ],
  ])("rejects %s", async (_n, response) => {
    await expect(isReplaceableTokenRejection(response)).resolves.toBe(false);
  });

  it("refuses an oversized envelope by its declared length, before buffering any of it", async () => {
    // A body that would parse as the code, but whose declared length is over the limit.
    const response = new Response(JSON.stringify({ code: "token_key_unknown" }), {
      status: 401,
      headers: { "content-type": "application/json", "content-length": "5000" },
    });
    await expect(isReplaceableTokenRejection(response)).resolves.toBe(false);
  });

  it("limits an undeclared body by bytes, not characters", async () => {
    // 1500 three-byte characters are 4500 bytes but only 1500 characters.
    const body = JSON.stringify({ code: "token_key_unknown", pad: "€".repeat(1500) });
    expect(body.length).toBeLessThan(4096);
    const response = new Response(new TextEncoder().encode(body), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
    await expect(isReplaceableTokenRejection(response)).resolves.toBe(false);
  });

  it("limits a streamed body without a declared length", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(1024)));
      },
    });
    const response = new Response(stream, {
      status: 401,
      headers: { "content-type": "application/json" },
    });
    await expect(isReplaceableTokenRejection(response)).resolves.toBe(false);
  });
});

describe("sendWithKeyRetry", () => {
  it("refreshes and sends once more on a replaceable rejection, naming the rejected token", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(keyUnknown())
      .mockResolvedValueOnce(Response.json({}));
    const refresh = vi.fn().mockResolvedValue({ token: "fresh" });
    const out = await sendWithKeyRetry({ resource: { token: "stale" }, refresh, send });
    expect(send.mock.calls.map((c) => c[0].token)).toEqual(["stale", "fresh"]);
    expect(refresh).toHaveBeenCalledExactlyOnceWith({ token: "stale" });
    expect(out.resource).toEqual({ token: "fresh" });
    expect(out.response.status).toBe(200);
  });

  it("retries an expired token too", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(rejected("token_expired"))
      .mockResolvedValueOnce(Response.json({}));
    const out = await sendWithKeyRetry({
      resource: { token: "old" },
      refresh: async () => ({ token: "new" }),
      send,
    });
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

  it("never loops: a second replaceable answer is returned as is", async () => {
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

  it("returns the first answer, unread, when no replacement is available", async () => {
    const send = vi.fn(async () => keyUnknown());
    const out = await sendWithKeyRetry({
      resource: { token: "s" },
      refresh: async () => null,
      send,
    });
    expect(send).toHaveBeenCalledOnce();
    await expect(out.response.json()).resolves.toMatchObject({ code: "token_key_unknown" });
  });

  it("passes a failed exchange on without sending again", async () => {
    const send = vi.fn(async () => keyUnknown());
    const boom = new Error("issuer down");
    const refresh = vi.fn().mockRejectedValue(boom);
    await expect(sendWithKeyRetry({ resource: { token: "s" }, refresh, send })).rejects.toBe(boom);
    expect(send).toHaveBeenCalledOnce();
  });
});

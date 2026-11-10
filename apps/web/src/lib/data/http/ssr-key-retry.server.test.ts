import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isReplayableBody, sendWithSsrKeyRetry } = await import("./ssr-key-retry.server");

const replaceable = (code = "token_key_unknown") =>
  Response.json({ error: "Unauthorized", code }, { status: 401 });

function builder(...bearers: Array<string | null>) {
  const queue = [...bearers];
  return vi.fn(async (_rejected?: string) => {
    const bearer = queue.shift() ?? null;
    return new Headers(bearer ? { authorization: `Bearer ${bearer}` } : {});
  });
}

const bearerOf = (headers: Headers) => headers.get("authorization");

describe("sendWithSsrKeyRetry", () => {
  it("rebuilds the headers without the rejected token and sends once more", async () => {
    const buildHeaders = builder("stale", "fresh");
    const send = vi
      .fn<(headers: Headers) => Promise<Response>>()
      .mockResolvedValueOnce(replaceable("token_expired"))
      .mockResolvedValueOnce(Response.json({ ok: true }));

    const response = await sendWithSsrKeyRetry({ buildHeaders, send });

    expect(response.status).toBe(200);
    expect(buildHeaders.mock.calls.map(([rejected]) => rejected)).toEqual([undefined, "stale"]);
    expect(send.mock.calls.map(([headers]) => bearerOf(headers))).toEqual([
      "Bearer stale",
      "Bearer fresh",
    ]);
  });

  it("returns the first answer when no different token can be had", async () => {
    for (const second of [null, "stale"]) {
      const send = vi.fn(async () => replaceable());
      const response = await sendWithSsrKeyRetry({ buildHeaders: builder("stale", second), send });
      expect(response.status).toBe(401);
      expect(send).toHaveBeenCalledOnce();
    }
  });

  it("does not retry an anonymous request, another 401, or a body that cannot be replayed", async () => {
    const anonymous = vi.fn(async () => replaceable());
    await sendWithSsrKeyRetry({ buildHeaders: builder(null), send: anonymous });
    expect(anonymous).toHaveBeenCalledOnce();

    const plain = vi.fn(async () => replaceable("session_required"));
    const buildPlain = builder("t", "t2");
    await sendWithSsrKeyRetry({ buildHeaders: buildPlain, send: plain });
    expect(plain).toHaveBeenCalledOnce();
    expect(buildPlain).toHaveBeenCalledOnce();

    const streamed = vi.fn(async () => replaceable());
    await sendWithSsrKeyRetry({
      buildHeaders: builder("t", "t2"),
      send: streamed,
      replayable: false,
    });
    expect(streamed).toHaveBeenCalledOnce();
  });
});

describe("isReplayableBody", () => {
  it("is false only for a stream", () => {
    expect(isReplayableBody(undefined)).toBe(true);
    expect(isReplayableBody(null)).toBe(true);
    expect(isReplayableBody('{"a":1}')).toBe(true);
    expect(isReplayableBody(new URLSearchParams({ a: "1" }))).toBe(true);
    expect(isReplayableBody(new FormData())).toBe(true);
    expect(isReplayableBody(new ReadableStream())).toBe(false);
  });
});

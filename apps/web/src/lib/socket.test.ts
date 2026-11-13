import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveSocketHandshakeAuth = vi.fn();
const io = vi.fn();

vi.mock("@/lib/socket-auth.client", () => ({
  resolveSocketHandshakeAuth,
}));

vi.mock("socket.io-client", () => ({
  io,
}));

describe("getSocket", () => {
  beforeEach(() => {
    vi.resetModules();
    io.mockReset();
    resolveSocketHandshakeAuth.mockReset();
    io.mockReturnValue({ id: "mock-socket" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes an auth callback that resolves handshake auth before connect", async () => {
    resolveSocketHandshakeAuth.mockResolvedValue({ token: "fresh-jwt" });
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "https://ws.test");

    const { getSocket } = await import("./socket");
    getSocket();

    // The client is fetched on demand, so the connection opens a tick later.
    await vi.waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });
    const options = io.mock.calls[0]?.[1] as {
      auth: (cb: (data: { token?: string }) => void) => void;
    };
    expect(typeof options.auth).toBe("function");

    const cb = vi.fn();
    options.auth(cb);
    await vi.waitFor(() => {
      expect(cb).toHaveBeenCalledWith({ token: "fresh-jwt" });
    });
    expect(resolveSocketHandshakeAuth).toHaveBeenCalledTimes(1);
  });

  it("passes empty auth when handshake resolver returns anonymous auth", async () => {
    resolveSocketHandshakeAuth.mockResolvedValue({});

    const { getSocket } = await import("./socket");
    getSocket();

    await vi.waitFor(() => {
      expect(io).toHaveBeenCalledTimes(1);
    });
    const options = io.mock.calls[0]?.[1] as {
      auth: (cb: (data: { token?: string }) => void) => void;
    };
    const cb = vi.fn();
    options.auth(cb);
    await vi.waitFor(() => {
      expect(cb).toHaveBeenCalledWith({});
    });
  });

  describe("after a deploy has removed the client's chunk", () => {
    const chunkUrl = "https://test.lax.bid/_next/static/chunks/98870.0123abcd.js";

    afterEach(() => {
      vi.doUnmock("@/lib/socket-connection");
      vi.unstubAllGlobals();
      vi.useRealTimers();
      window.sessionStorage.clear();
    });

    it("reports a connection error, checks the chunk, and reloads the page once", async () => {
      vi.useFakeTimers();
      // No jitter: retries wait exactly 1 s, 2 s, then 4 s, so the 5 s window below holds the
      // first failure and two retries. With jitter a third retry (≥ 3.5 s in) could land inside it.
      vi.spyOn(Math, "random").mockReturnValue(0);
      const chunkError = Object.assign(
        new Error(`Loading chunk 98870 failed.\n(error: ${chunkUrl})`),
        {
          name: "ChunkLoadError",
          type: "error",
          request: chunkUrl,
        },
      );
      vi.doMock("@/lib/socket-connection", () => {
        throw chunkError;
      });
      const fetchSpy = vi.fn(async () => new Response(null, { status: 404 }));
      vi.stubGlobal("fetch", fetchSpy);
      // jsdom cannot navigate; the reload is recorded in sessionStorage just before it is asked for.
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const { getSocket } = await import("./socket");
      const socket = getSocket();
      const onConnectError = vi.fn();
      const onReconnectAttempt = vi.fn();
      socket.on("connect_error", onConnectError);
      socket.io.on("reconnect_attempt", onReconnectAttempt);

      await vi.advanceTimersByTimeAsync(0);
      expect(onConnectError).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Two more failures (≤ 1.5 s + ≤ 3 s), then the chunk is checked.
      await vi.advanceTimersByTimeAsync(5000);
      expect(onReconnectAttempt).toHaveBeenCalledWith(2);
      expect(onConnectError).toHaveBeenCalledTimes(3);
      expect(fetchSpy).toHaveBeenCalledWith(chunkUrl, { method: "HEAD", cache: "no-store" });
      expect(window.sessionStorage.getItem("lax:live-socket-chunk-reload-at")).not.toBeNull();
      expect(io).not.toHaveBeenCalled();
      consoleError.mockRestore();
      vi.mocked(Math.random).mockRestore();
    });
  });
});

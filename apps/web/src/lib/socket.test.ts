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

    expect(io).toHaveBeenCalledTimes(1);
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

    const options = io.mock.calls[0]?.[1] as {
      auth: (cb: (data: { token?: string }) => void) => void;
    };
    const cb = vi.fn();
    options.auth(cb);
    await vi.waitFor(() => {
      expect(cb).toHaveBeenCalledWith({});
    });
  });
});

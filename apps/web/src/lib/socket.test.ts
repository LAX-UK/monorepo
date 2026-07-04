import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchAuthJwtForSocket = vi.fn();
const io = vi.fn();

vi.mock("@/lib/socket-auth.client", () => ({
  fetchAuthJwtForSocket,
}));

vi.mock("socket.io-client", () => ({
  io,
}));

describe("getSocket", () => {
  beforeEach(() => {
    vi.resetModules();
    io.mockReset();
    fetchAuthJwtForSocket.mockReset();
    io.mockReturnValue({ id: "mock-socket" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes an auth callback that resolves the fetched JWT before connect", async () => {
    fetchAuthJwtForSocket.mockResolvedValue("fresh-jwt");
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
    expect(fetchAuthJwtForSocket).toHaveBeenCalledTimes(1);
  });

  it("passes empty auth when token fetch returns null", async () => {
    fetchAuthJwtForSocket.mockResolvedValue(null);

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

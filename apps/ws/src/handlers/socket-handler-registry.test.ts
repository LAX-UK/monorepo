import type { Server, Socket } from "socket.io";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifySocketToken } = vi.hoisted(() => ({
  verifySocketToken: vi.fn(),
}));

vi.mock("../services/jwt-verifier.js", () => ({
  verifySocketToken,
}));

import { registerSocketHandlers } from "./socket-handler-registry.js";

describe("registerSocketHandlers joinLot", () => {
  const env = {
    OIDC_ISSUER: "https://auth.test",
    JWKS_URL: "https://auth.test/jwks",
    LEGACY_WS_COOKIE_RELAY: false,
    API_URL: "https://api.test",
  };

  beforeEach(() => {
    verifySocketToken.mockReset();
  });

  it("joins lot room when token verification fails (expired/invalid JWT)", async () => {
    verifySocketToken.mockResolvedValue(null);

    const handlers = new Map<string, (payload: unknown, ack: (result: unknown) => void) => void>();
    const socket = {
      handshake: { auth: { token: "expired.jwt" }, headers: {} },
      data: {},
      join: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(
        (event: string, handler: (payload: unknown, ack: (result: unknown) => void) => void) => {
          handlers.set(event, handler);
        },
      ),
    } as unknown as Socket;

    registerSocketHandlers(socket, { io: {} as Server, env: env as never });

    const ack = vi.fn();
    const joinLot = handlers.get("joinLot");
    expect(joinLot).toBeDefined();
    joinLot?.({ lotId: "lot-1" }, ack);

    await vi.waitFor(() => {
      expect(socket.join).toHaveBeenCalledWith("lot:lot-1");
    });
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });
});

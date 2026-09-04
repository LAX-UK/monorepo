import { createHash } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerSocketHandlers } from "./socket-handler-registry.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("registerSocketHandlers joinLot", () => {
  it("joins public lot room when the ticket is absent", async () => {
    const handlers = new Map<string, (payload: unknown, ack: (result: unknown) => void) => void>();
    const socket = {
      handshake: { auth: {}, headers: {} },
      data: {},
      join: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(
        (event: string, handler: (payload: unknown, ack: (result: unknown) => void) => void) => {
          handlers.set(event, handler);
        },
      ),
    } as unknown as Socket;

    registerSocketHandlers(socket, {
      io: {} as Server,
      env: {} as never,
      ticketStore: { getdel: vi.fn().mockResolvedValue(null) },
    });

    const ack = vi.fn();
    const joinLot = handlers.get("joinLot");
    expect(joinLot).toBeDefined();
    joinLot?.({ lotId: "lot-1" }, ack);

    await vi.waitFor(() => {
      expect(socket.join).toHaveBeenCalledWith("lot:lot-1");
    });
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  it("consumes a one-time ticket and caches its bound user on the socket", async () => {
    const ticket = "a".repeat(43);
    const getdel = vi.fn().mockResolvedValueOnce(
      JSON.stringify({
        subject: "user-1",
        sid: "identity-session-1",
        role: "staff",
        staffRole: "super_admin",
        audience: "lax-ws",
        scopes: ["bid.read"],
        apiResourceToken: "api-token",
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: "user-1", role: "staff", staffRole: "super_admin" },
          }),
          { status: 200 },
        ),
      ),
    );
    const handlers = new Map<string, (payload: unknown, ack: (result: unknown) => void) => void>();
    const socket = {
      handshake: { auth: { ticket }, headers: {} },
      data: {},
      join: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(
        (event: string, handler: (payload: unknown, ack: (result: unknown) => void) => void) => {
          handlers.set(event, handler);
        },
      ),
    } as unknown as Socket;

    registerSocketHandlers(socket, {
      io: {} as Server,
      env: { API_URL: "https://api.lax.bid" } as never,
      ticketStore: { getdel },
    });
    handlers.get("joinLot")?.({ lotId: "lot-1" }, vi.fn());

    await vi.waitFor(() => expect(socket.data.userId).toBe("user-1"));
    expect(getdel).toHaveBeenCalledWith(
      `bid:ws-ticket:${createHash("sha256").update(ticket).digest("base64url")}`,
    );
    expect(socket.data.isAdmin).toBe(true);
    expect(socket.data.authSubject).toBe("user-1");
    expect(socket.data.authSid).toBe("identity-session-1");
    expect(socket.data.privilegeToken).toBe("api-token");
    handlers.get("joinLot")?.({ lotId: "lot-2" }, vi.fn());
    await vi.waitFor(() => expect(socket.join).toHaveBeenCalledWith("lot:lot-2"));
    expect(getdel).toHaveBeenCalledTimes(1);
  });

  it("denies a stale cached staff role when the API reports a buyer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "user-1", role: "buyer" } }), {
          status: 200,
        }),
      ),
    );
    const handlers = new Map<string, (payload: unknown, ack: (result: unknown) => void) => void>();
    const socket = {
      handshake: { auth: {}, headers: {} },
      data: {
        ticketUser: { id: "user-1", role: "staff", staff_role: "super_admin" },
        privilegeToken: "api-token",
      },
      join: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(
        (event: string, handler: (payload: unknown, ack: (result: unknown) => void) => void) => {
          handlers.set(event, handler);
        },
      ),
    } as unknown as Socket;
    registerSocketHandlers(socket, {
      io: {} as Server,
      env: { API_URL: "https://api.lax.bid" } as never,
      ticketStore: { getdel: vi.fn() },
    });

    handlers.get("joinSaleroom")?.({ saleId: "sale-1" }, vi.fn());
    await vi.waitFor(() => expect(socket.join).toHaveBeenCalledWith("sale:sale-1"));
    expect(socket.join).not.toHaveBeenCalledWith("display:sale-1");
  });

  it("denies privilege when no retained API credential is available", async () => {
    const handlers = new Map<string, (payload: unknown, ack: (result: unknown) => void) => void>();
    const socket = {
      handshake: { auth: {}, headers: {} },
      data: { ticketUser: { id: "user-1", role: "staff", staff_role: "super_admin" } },
      join: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(
        (event: string, handler: (payload: unknown, ack: (result: unknown) => void) => void) => {
          handlers.set(event, handler);
        },
      ),
    } as unknown as Socket;
    registerSocketHandlers(socket, {
      io: {} as Server,
      env: { API_URL: "https://api.lax.bid" } as never,
      ticketStore: { getdel: vi.fn() },
    });

    handlers.get("joinLot")?.({ lotId: "lot-1" }, vi.fn());
    await vi.waitFor(() => expect(socket.join).toHaveBeenCalledWith("lot:lot-1"));
    expect(socket.data.isAdmin).toBe(false);
  });

  it("rejects replay after the ticket has already been consumed", async () => {
    const handlers = new Map<string, (payload: unknown, ack: (result: unknown) => void) => void>();
    const ack = vi.fn();
    const socket = {
      handshake: { auth: { ticket: "b".repeat(43) }, headers: {} },
      data: {},
      join: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(
        (event: string, handler: (payload: unknown, ack: (result: unknown) => void) => void) => {
          handlers.set(event, handler);
        },
      ),
    } as unknown as Socket;
    registerSocketHandlers(socket, {
      io: {} as Server,
      env: {} as never,
      ticketStore: { getdel: vi.fn().mockResolvedValue(null) },
    });
    handlers.get("joinUser")?.({}, ack);
    await vi.waitFor(() =>
      expect(ack).toHaveBeenCalledWith({ ok: false, error: "unauthenticated" }),
    );
  });

  it("rejects tickets without the exact WS audience and bid.read scope", async () => {
    const socket = {
      handshake: { auth: { ticket: "c".repeat(43) }, headers: {} },
      data: {},
    } as unknown as Socket;
    const { consumeSocketTicket } = await import("./socket-handler-registry.js");
    await expect(
      consumeSocketTicket(socket, {
        getdel: async () =>
          JSON.stringify({
            subject: "user-1",
            sid: "sid-1",
            role: "buyer",
            audience: "lax-bid-api",
            scopes: ["bid.write"],
          }),
      }),
    ).resolves.toBe("invalid");
  });
});

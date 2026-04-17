import type { Server, Socket } from "socket.io";
import type { WsEnv } from "../env.js";

export type HandlerContext = {
  io: Server;
  env: WsEnv;
};

function roomForAuction(auctionId: string): string {
  return `auction:${auctionId}`;
}

function roomForUser(userId: string): string {
  return `user:${userId}`;
}

type AckFn = ((result: unknown) => void) | undefined;

async function resolveUserIdFromSession(socket: Socket, env: WsEnv): Promise<string | null> {
  const cookie = socket.handshake.headers.cookie;
  if (!cookie) return null;
  try {
    const res = await fetch(`${env.API_URL}/users/me`, {
      headers: { cookie, accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id?: string } };
    const id = json.data?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

function handleJoinAuction(
  socket: Socket,
  _ctx: HandlerContext,
  payload: { auctionId?: string },
  ack: AckFn,
) {
  const auctionId = payload?.auctionId;
  if (!auctionId) {
    ack?.({ ok: false, error: "auctionId required" });
    return;
  }
  void socket.join(roomForAuction(auctionId));
  ack?.({ ok: true });
}

function handleLeaveAuction(
  socket: Socket,
  _ctx: HandlerContext,
  payload: { auctionId?: string },
  ack: AckFn,
) {
  const auctionId = payload?.auctionId;
  if (!auctionId) {
    ack?.({ ok: false, error: "auctionId required" });
    return;
  }
  void socket.leave(roomForAuction(auctionId));
  ack?.({ ok: true });
}

async function handleJoinUser(socket: Socket, ctx: HandlerContext, _payload: unknown, ack: AckFn) {
  const userId = await resolveUserIdFromSession(socket, ctx.env);
  if (!userId) {
    ack?.({ ok: false, error: "unauthenticated" });
    return;
  }
  await socket.join(roomForUser(userId));
  ack?.({ ok: true });
}

async function handleLeaveUser(socket: Socket, ctx: HandlerContext, _payload: unknown, ack: AckFn) {
  const userId = await resolveUserIdFromSession(socket, ctx.env);
  if (!userId) {
    ack?.({ ok: false, error: "unauthenticated" });
    return;
  }
  await socket.leave(roomForUser(userId));
  ack?.({ ok: true });
}

/** OCP: register new handlers here without editing connection boilerplate. */
const handlers: Record<
  string,
  (socket: Socket, ctx: HandlerContext, payload: unknown, ack: AckFn) => void | Promise<void>
> = {
  joinAuction: (socket, ctx, payload, ack) =>
    handleJoinAuction(socket, ctx, payload as { auctionId?: string }, ack),
  leaveAuction: (socket, ctx, payload, ack) =>
    handleLeaveAuction(socket, ctx, payload as { auctionId?: string }, ack),
  joinUser: (socket, ctx, payload, ack) => void handleJoinUser(socket, ctx, payload, ack),
  leaveUser: (socket, ctx, payload, ack) => void handleLeaveUser(socket, ctx, payload, ack),
};

export function registerSocketHandlers(socket: Socket, ctx: HandlerContext): void {
  for (const [event, fn] of Object.entries(handlers)) {
    socket.on(event, (payload: unknown, ack: AckFn) => {
      void Promise.resolve(fn(socket, ctx, payload, ack)).catch((err: unknown) => {
        console.error(`socket handler ${event}`, err);
        ack?.({ ok: false, error: "internal" });
      });
    });
  }
}

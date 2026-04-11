import type { Server, Socket } from "socket.io";
import type { WsEnv } from "../env.js";

export type HandlerContext = {
  io: Server;
  env: WsEnv;
};

function roomForAuction(auctionId: string): string {
  return `auction:${auctionId}`;
}

type AckFn = ((result: unknown) => void) | undefined;

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

/** OCP: register new handlers here without editing connection boilerplate. */
const handlers: Record<
  string,
  (socket: Socket, ctx: HandlerContext, payload: unknown, ack: AckFn) => void
> = {
  joinAuction: (socket, ctx, payload, ack) =>
    handleJoinAuction(socket, ctx, payload as { auctionId?: string }, ack),
  leaveAuction: (socket, ctx, payload, ack) =>
    handleLeaveAuction(socket, ctx, payload as { auctionId?: string }, ack),
};

export function registerSocketHandlers(socket: Socket, ctx: HandlerContext): void {
  for (const [event, fn] of Object.entries(handlers)) {
    socket.on(event, (payload: unknown, ack: AckFn) => {
      fn(socket, ctx, payload, ack);
    });
  }
}

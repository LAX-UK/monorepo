import { normalizeUserRoleOrClient, roleHasCapability, type UserRole } from "@auction/types";
import type { Server, Socket } from "socket.io";
import type { WsEnv } from "../env.js";

export type HandlerContext = {
  io: Server;
  env: WsEnv;
};

function roomForLot(lotId: string): string {
  return `lot:${lotId}`;
}

function roomForUser(userId: string): string {
  return `user:${userId}`;
}

type AckFn = ((result: unknown) => void) | undefined;

async function resolveSessionUser(
  socket: Socket,
  env: WsEnv,
): Promise<{ id: string; role: string } | null> {
  const cookie = socket.handshake.headers.cookie;
  if (!cookie) return null;
  try {
    const res = await fetch(`${env.API_URL}/users/me`, {
      headers: { cookie, accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id?: string; role?: string } };
    const id = json.data?.id;
    const role = json.data?.role;
    return typeof id === "string" && typeof role === "string" ? { id, role } : null;
  } catch {
    return null;
  }
}

async function handleJoinLot(
  socket: Socket,
  ctx: HandlerContext,
  payload: { lotId?: string },
  ack: AckFn,
) {
  const lotId = payload?.lotId;
  if (!lotId) {
    ack?.({ ok: false, error: "lotId required" });
    return;
  }
  const me = await resolveSessionUser(socket, ctx.env);
  socket.data.userId = me?.id;
  const role = me ? (normalizeUserRoleOrClient(me.role) as UserRole) : null;
  socket.data.isAdmin = role != null && roleHasCapability(role, "platform.admin.full");
  await socket.join(roomForLot(lotId));
  ack?.({ ok: true });
}

function handleLeaveLot(
  socket: Socket,
  _ctx: HandlerContext,
  payload: { lotId?: string },
  ack: AckFn,
) {
  const lotId = payload?.lotId;
  if (!lotId) {
    ack?.({ ok: false, error: "lotId required" });
    return;
  }
  void socket.leave(roomForLot(lotId));
  ack?.({ ok: true });
}

async function handleJoinUser(socket: Socket, ctx: HandlerContext, _payload: unknown, ack: AckFn) {
  const me = await resolveSessionUser(socket, ctx.env);
  if (!me) {
    ack?.({ ok: false, error: "unauthenticated" });
    return;
  }
  socket.data.userId = me.id;
  const role = normalizeUserRoleOrClient(me.role) as UserRole;
  socket.data.isAdmin = roleHasCapability(role, "platform.admin.full");
  await socket.join(roomForUser(me.id));
  ack?.({ ok: true });
}

async function handleLeaveUser(socket: Socket, ctx: HandlerContext, _payload: unknown, ack: AckFn) {
  const me = await resolveSessionUser(socket, ctx.env);
  if (!me) {
    ack?.({ ok: false, error: "unauthenticated" });
    return;
  }
  await socket.leave(roomForUser(me.id));
  ack?.({ ok: true });
}

/** OCP: register new handlers here without editing connection boilerplate. */
const handlers: Record<
  string,
  (socket: Socket, ctx: HandlerContext, payload: unknown, ack: AckFn) => void | Promise<void>
> = {
  joinLot: (socket, ctx, payload, ack) =>
    handleJoinLot(socket, ctx, payload as { lotId?: string }, ack),
  leaveLot: (socket, ctx, payload, ack) =>
    handleLeaveLot(socket, ctx, payload as { lotId?: string }, ack),
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

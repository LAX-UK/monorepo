import {
  type UserRole,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import type { Server, Socket } from "socket.io";
import type { WsEnv } from "../env.js";
import { verifySocketToken } from "../services/jwt-verifier.js";

export type HandlerContext = {
  io: Server;
  env: WsEnv;
  /** Optional: record server-side latency probe ack duration (seconds). */
  recordLatencyProbeAckSeconds?: (seconds: number) => void;
};

function roomForLot(lotId: string): string {
  return `lot:${lotId}`;
}

function roomForUser(userId: string): string {
  return `user:${userId}`;
}

function roomForSale(saleId: string): string {
  return `sale:${saleId}`;
}

type AckFn = ((result: unknown) => void) | undefined;

async function resolveSessionUser(
  socket: Socket,
  env: WsEnv,
): Promise<{ id: string; role: string; staff_role?: string } | null> {
  const token =
    typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : undefined;
  const jwtUser = await verifySocketToken({
    token,
    issuer: env.OIDC_ISSUER,
    jwksUrl: env.JWKS_URL,
  });
  if (jwtUser) {
    return {
      id: jwtUser.id,
      role: jwtUser.role,
      ...(jwtUser.staff_role !== undefined ? { staff_role: jwtUser.staff_role } : {}),
    };
  }

  if (!env.LEGACY_WS_COOKIE_RELAY) return null;
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
  const staff = me ? normalizeUserStaffRole(me.staff_role) : null;
  socket.data.isAdmin = role != null && roleHasCapability(role, "platform.admin.full", staff);
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

function handleJoinSaleroom(
  socket: Socket,
  _ctx: HandlerContext,
  payload: { saleId?: string },
  ack: AckFn,
) {
  const saleId = payload?.saleId;
  if (!saleId) {
    ack?.({ ok: false, error: "saleId required" });
    return;
  }
  void socket.join(roomForSale(saleId));
  ack?.({ ok: true });
}

function handleLeaveSaleroom(
  socket: Socket,
  _ctx: HandlerContext,
  payload: { saleId?: string },
  ack: AckFn,
) {
  const saleId = payload?.saleId;
  if (!saleId) {
    ack?.({ ok: false, error: "saleId required" });
    return;
  }
  void socket.leave(roomForSale(saleId));
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
  const staff = normalizeUserStaffRole(me.staff_role);
  socket.data.isAdmin = roleHasCapability(role, "platform.admin.full", staff);
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

function handleLatencyProbe(_socket: Socket, ctx: HandlerContext, _payload: unknown, ack: AckFn) {
  const t0 = process.hrtime.bigint();
  ack?.({ ok: true, serverNow: Date.now() });
  const elapsedSec = Number(process.hrtime.bigint() - t0) / 1e9;
  ctx.recordLatencyProbeAckSeconds?.(elapsedSec);
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
  joinSaleroom: (socket, ctx, payload, ack) =>
    handleJoinSaleroom(socket, ctx, payload as { saleId?: string }, ack),
  leaveSaleroom: (socket, ctx, payload, ack) =>
    handleLeaveSaleroom(socket, ctx, payload as { saleId?: string }, ack),
  joinUser: (socket, ctx, payload, ack) => void handleJoinUser(socket, ctx, payload, ack),
  leaveUser: (socket, ctx, payload, ack) => void handleLeaveUser(socket, ctx, payload, ack),
  latencyProbe: (socket, ctx, payload, ack) => handleLatencyProbe(socket, ctx, payload, ack),
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

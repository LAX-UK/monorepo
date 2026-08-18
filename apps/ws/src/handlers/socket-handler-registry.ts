import { createHash } from "node:crypto";
import { captureBackgroundError } from "@auction/observability";
import {
  type UserRole,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import type { Server, Socket } from "socket.io";
import type { WsEnv } from "../env.js";

export type HandlerContext = {
  io: Server;
  env: WsEnv;
  /** Optional: record server-side latency probe ack duration (seconds). */
  recordLatencyProbeAckSeconds?: (seconds: number) => void;
  ticketStore: { getdel(key: string): Promise<string | null> };
};

type TicketUser = { id: string; sid?: string; role: string; staff_role?: string };

/** Consume and bind the one-time BFF ticket during the Socket.IO handshake. */
export async function consumeSocketTicket(
  socket: Socket,
  ticketStore: HandlerContext["ticketStore"],
): Promise<"anonymous" | "authenticated" | "invalid"> {
  const ticket =
    typeof socket.handshake.auth?.ticket === "string" ? socket.handshake.auth.ticket : undefined;
  if (!ticket) return "anonymous";
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return "invalid";
  try {
    const key = `bid:ws-ticket:${createHash("sha256").update(ticket).digest("base64url")}`;
    const raw = await ticketStore.getdel(key);
    if (!raw) return "invalid";
    const value = JSON.parse(raw) as {
      subject?: unknown;
      sid?: unknown;
      role?: unknown;
      staffRole?: unknown;
      audience?: unknown;
      scopes?: unknown;
      apiResourceToken?: unknown;
    };
    if (
      typeof value.subject !== "string" ||
      typeof value.sid !== "string" ||
      typeof value.role !== "string" ||
      value.audience !== "lax-ws" ||
      !Array.isArray(value.scopes) ||
      !value.scopes.includes("bid.read")
    ) {
      return "invalid";
    }
    const user: TicketUser =
      typeof value.staffRole === "string"
        ? { id: value.subject, role: value.role, staff_role: value.staffRole }
        : { id: value.subject, role: value.role };
    socket.data.ticketUser = user;
    socket.data.authSubject = value.subject;
    socket.data.authSid = value.sid;
    if (typeof value.apiResourceToken === "string" && value.apiResourceToken.length > 0) {
      socket.data.privilegeToken = value.apiResourceToken;
    }
    return "authenticated";
  } catch {
    return "invalid";
  }
}

function roomForLot(lotId: string): string {
  return `lot:${lotId}`;
}

function roomForUser(userId: string): string {
  return `user:${userId}`;
}

function roomForSale(saleId: string): string {
  return `sale:${saleId}`;
}

function roomForDisplay(saleId: string): string {
  return `display:${saleId}`;
}

type AckFn = ((result: unknown) => void) | undefined;

async function resolveSessionUser(
  socket: Socket,
  ctx: HandlerContext,
): Promise<{ id: string; role: string; staff_role?: string } | null> {
  const cached = socket.data.ticketUser as TicketUser | undefined;
  if (cached) return cached;
  const consumed = await consumeSocketTicket(socket, ctx.ticketStore);
  return consumed === "authenticated" ? (socket.data.ticketUser as TicketUser) : null;
}

async function resolveCurrentCapability(
  socket: Socket,
  ctx: HandlerContext,
  capability: "auction.manage" | "platform.admin.full",
): Promise<boolean> {
  const cached = await resolveSessionUser(socket, ctx);
  if (!cached) return false;
  const cachedRole = normalizeUserRoleOrClient(cached.role) as UserRole;
  const cachedStaff = normalizeUserStaffRole(cached.staff_role);
  if (!roleHasCapability(cachedRole, capability, cachedStaff)) return false;

  const token =
    typeof socket.data.privilegeToken === "string" ? socket.data.privilegeToken : undefined;
  if (!token) return false;
  try {
    const response = await fetch(`${ctx.env.API_URL}/users/me`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as {
      data?: {
        id?: unknown;
        role?: unknown;
        staffRole?: unknown;
        suspended?: unknown;
      };
    };
    if (
      body.data?.id !== cached.id ||
      typeof body.data.role !== "string" ||
      body.data.suspended === true
    ) {
      return false;
    }
    const role = normalizeUserRoleOrClient(body.data.role) as UserRole;
    const staff =
      typeof body.data.staffRole === "string"
        ? normalizeUserStaffRole(body.data.staffRole)
        : undefined;
    return roleHasCapability(role, capability, staff);
  } catch {
    return false;
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
  const me = await resolveSessionUser(socket, ctx);
  socket.data.userId = me?.id;
  socket.data.isAdmin = me
    ? await resolveCurrentCapability(socket, ctx, "platform.admin.full")
    : false;
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
  ctx: HandlerContext,
  payload: { saleId?: string },
  ack: AckFn,
) {
  void handleJoinSaleroomAsync(socket, ctx, payload, ack);
}

async function handleJoinSaleroomAsync(
  socket: Socket,
  ctx: HandlerContext,
  payload: { saleId?: string },
  ack: AckFn,
) {
  const saleId = payload?.saleId;
  if (!saleId) {
    ack?.({ ok: false, error: "saleId required" });
    return;
  }
  const me = await resolveSessionUser(socket, ctx);
  socket.data.userId = me?.id;
  const canManageSaleroom = me
    ? await resolveCurrentCapability(socket, ctx, "auction.manage")
    : false;
  await socket.join(roomForSale(saleId));
  if (canManageSaleroom) {
    await socket.join(roomForDisplay(saleId));
  }
  ack?.({ ok: true });
}

function handleLeaveSaleroom(
  socket: Socket,
  _ctx: HandlerContext,
  payload: { saleId?: string },
  ack: AckFn,
) {
  void handleLeaveSaleroomAsync(socket, payload, ack);
}

async function handleLeaveSaleroomAsync(socket: Socket, payload: { saleId?: string }, ack: AckFn) {
  const saleId = payload?.saleId;
  if (!saleId) {
    ack?.({ ok: false, error: "saleId required" });
    return;
  }
  await socket.leave(roomForSale(saleId));
  await socket.leave(roomForDisplay(saleId));
  ack?.({ ok: true });
}

async function verifyDisplayTokenForJoin(
  env: WsEnv,
  saleId: string,
  displayToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${env.API_URL}/display/${encodeURIComponent(saleId)}/verify`, {
      headers: { Authorization: `Bearer ${displayToken}`, accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function handleJoinDisplay(
  socket: Socket,
  ctx: HandlerContext,
  payload: { saleId?: string; displayToken?: string },
  ack: AckFn,
) {
  const saleId = payload?.saleId;
  const displayToken = payload?.displayToken;
  if (!saleId || !displayToken) {
    ack?.({ ok: false, error: "saleId and displayToken required" });
    return;
  }
  const valid = await verifyDisplayTokenForJoin(ctx.env, saleId, displayToken);
  if (!valid) {
    ack?.({ ok: false, error: "invalid_display_token" });
    return;
  }
  await socket.join(roomForDisplay(saleId));
  ack?.({ ok: true });
}

function handleLeaveDisplay(
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
  void socket.leave(roomForDisplay(saleId));
  ack?.({ ok: true });
}

async function handleJoinUser(socket: Socket, ctx: HandlerContext, _payload: unknown, ack: AckFn) {
  const me = await resolveSessionUser(socket, ctx);
  if (!me) {
    ack?.({ ok: false, error: "unauthenticated" });
    return;
  }
  socket.data.userId = me.id;
  socket.data.isAdmin = await resolveCurrentCapability(socket, ctx, "platform.admin.full");
  await socket.join(roomForUser(me.id));
  ack?.({ ok: true });
}

async function handleLeaveUser(socket: Socket, ctx: HandlerContext, _payload: unknown, ack: AckFn) {
  const me = await resolveSessionUser(socket, ctx);
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
  joinDisplay: (socket, ctx, payload, ack) =>
    handleJoinDisplay(socket, ctx, payload as { saleId?: string; displayToken?: string }, ack),
  leaveDisplay: (socket, ctx, payload, ack) =>
    handleLeaveDisplay(socket, ctx, payload as { saleId?: string }, ack),
  joinUser: (socket, ctx, payload, ack) => void handleJoinUser(socket, ctx, payload, ack),
  leaveUser: (socket, ctx, payload, ack) => void handleLeaveUser(socket, ctx, payload, ack),
  latencyProbe: (socket, ctx, payload, ack) => handleLatencyProbe(socket, ctx, payload, ack),
};

export function registerSocketHandlers(socket: Socket, ctx: HandlerContext): void {
  for (const [event, fn] of Object.entries(handlers)) {
    socket.on(event, (payload: unknown, ack: AckFn) => {
      void Promise.resolve(fn(socket, ctx, payload, ack)).catch((err: unknown) => {
        console.error(`socket handler ${event}`, err);
        captureBackgroundError(`ws-socket-${event}`, err);
        ack?.({ ok: false, error: "internal" });
      });
    });
  }
}

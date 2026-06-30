import "server-only";

import { parseSessionDisplayOverlay } from "@/features/saleroom/lib/display-overlay-state";
import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin-paddle.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { SaleroomDisplayOverlay } from "@auction/types";

function parseAdminPaddleRosterEntry(raw: unknown): AdminPaddleRosterEntry {
  const o = raw as Record<string, unknown>;
  return {
    paddleNumber: Number.parseInt(String(o.paddleNumber ?? "0"), 10),
    userId: String(o.userId ?? ""),
    displayName: String(o.displayName ?? ""),
    bidLimit: o.bidLimit == null ? null : String(o.bidLimit),
    hasActiveSelfServiceSession: Boolean(o.hasActiveSelfServiceSession),
  };
}

export async function getAdminSalePaddleRoster(saleId: string): Promise<AdminPaddleRosterEntry[]> {
  const res = await authedServerFetch(`/admin/sales/${encodeURIComponent(saleId)}/paddles`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load paddle roster: ${res.status}`);
  const body = (await res.json()) as { data: { items: unknown[] } };
  return body.data.items.map(parseAdminPaddleRosterEntry);
}

export type AdminSaleroomSessionRow = {
  id: string;
  saleId: string;
  status: string;
  currentLotId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  clerkUserId: string | null;
  auctioneerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  displayOverlay: SaleroomDisplayOverlay | null;
};

export type AdminSaleroomEventRow = {
  id: string;
  sessionId: string;
  kind: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  occurredAt: string;
};

export type AdminSaleroomSessionSnapshot = {
  session: AdminSaleroomSessionRow | null;
  events: AdminSaleroomEventRow[];
};

function parseIsoOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s.length > 0 ? s : null;
}

function parseAdminSaleroomSessionSnapshot(raw: unknown): AdminSaleroomSessionSnapshot {
  const o = raw as Record<string, unknown>;
  const sessionRaw = o.session as Record<string, unknown> | null | undefined;
  const session: AdminSaleroomSessionRow | null = sessionRaw
    ? {
        id: String(sessionRaw.id ?? ""),
        saleId: String(sessionRaw.saleId ?? ""),
        status: String(sessionRaw.status ?? ""),
        currentLotId: sessionRaw.currentLotId == null ? null : String(sessionRaw.currentLotId),
        startedAt: parseIsoOrNull(sessionRaw.startedAt),
        endedAt: parseIsoOrNull(sessionRaw.endedAt),
        clerkUserId: sessionRaw.clerkUserId == null ? null : String(sessionRaw.clerkUserId),
        auctioneerUserId:
          sessionRaw.auctioneerUserId == null ? null : String(sessionRaw.auctioneerUserId),
        createdAt: parseIsoOrNull(sessionRaw.createdAt) ?? "",
        updatedAt: parseIsoOrNull(sessionRaw.updatedAt) ?? "",
        displayOverlay: parseSessionDisplayOverlay(sessionRaw.displayOverlay),
      }
    : null;
  const eventsRaw = Array.isArray(o.events) ? o.events : [];
  const events: AdminSaleroomEventRow[] = eventsRaw.map((e) => {
    const row = e as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      sessionId: String(row.sessionId ?? ""),
      kind: String(row.kind ?? ""),
      payload: (row.payload as Record<string, unknown>) ?? {},
      actorUserId: row.actorUserId == null ? null : String(row.actorUserId),
      occurredAt: parseIsoOrNull(row.occurredAt) ?? "",
    };
  });
  return { session, events };
}

export async function getAdminSaleroomSession(
  saleId: string,
): Promise<AdminSaleroomSessionSnapshot> {
  const res = await authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/saleroom/session`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load saleroom session: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseAdminSaleroomSessionSnapshot(body.data);
}

export type AdminSaleroomSessionStatusRow = {
  saleId: string;
  status: "none" | "pending" | "live" | "paused" | "ended";
  currentLotId: string | null;
};

export async function getAdminSaleroomSessions(
  saleIds: string[],
): Promise<AdminSaleroomSessionStatusRow[]> {
  if (saleIds.length === 0) return [];
  const res = await authedServerFetch(
    `/admin/saleroom/sessions?saleIds=${saleIds.map(encodeURIComponent).join(",")}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load saleroom sessions: ${res.status}`);
  const body = (await res.json()) as { sessions: AdminSaleroomSessionStatusRow[] };
  return body.sessions ?? [];
}

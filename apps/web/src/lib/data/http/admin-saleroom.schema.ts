import { parseSessionDisplayOverlay } from "@/features/saleroom/lib/display-overlay-state";
import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin-paddle.types";
import type {
  AdminSaleroomEventRow,
  AdminSaleroomSessionRow,
  AdminSaleroomSessionSnapshot,
  AdminSaleroomSessionStatusRow,
} from "@/lib/data/http/admin-saleroom.types";
import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import { z } from "zod";

function parseIsoOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s.length > 0 ? s : null;
}

export const adminPaddleRosterEntrySchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): AdminPaddleRosterEntry => ({
      paddleNumber: Number.parseInt(String(row.paddleNumber ?? "0"), 10),
      userId: String(row.userId ?? ""),
      displayName: String(row.displayName ?? ""),
      bidLimit: row.bidLimit == null ? null : String(row.bidLimit),
      hasActiveSelfServiceSession: Boolean(row.hasActiveSelfServiceSession),
    }),
  );

const adminPaddleRosterItemsSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminPaddleRosterEntry[] => {
    const items = Array.isArray(row.items) ? row.items : [];
    return items.map((item) => adminPaddleRosterEntrySchema.parse(item));
  });

export const adminPaddleRosterItemsEnvelopeSchema = adminPaddleRosterItemsSchema as z.ZodType<
  AdminPaddleRosterEntry[]
>;

const adminSaleroomSessionRowSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform(
  (sessionRaw): AdminSaleroomSessionRow => ({
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
  }),
);

export const adminSaleroomSessionSnapshotSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminSaleroomSessionSnapshot => {
    const sessionRaw = isIndexableObject(row.session) ? row.session : null;
    const session = sessionRaw ? adminSaleroomSessionRowSchema.parse(sessionRaw) : null;
    const eventsRaw = Array.isArray(row.events) ? row.events : [];
    const events: AdminSaleroomEventRow[] = eventsRaw.map((event) => {
      const eventRow = isIndexableObject(event) ? event : {};
      return {
        id: String(eventRow.id ?? ""),
        sessionId: String(eventRow.sessionId ?? ""),
        kind: String(eventRow.kind ?? ""),
        payload: isIndexableObject(eventRow.payload) ? eventRow.payload : {},
        actorUserId: eventRow.actorUserId == null ? null : String(eventRow.actorUserId),
        occurredAt: parseIsoOrNull(eventRow.occurredAt) ?? "",
      };
    });
    return { session, events };
  }) as z.ZodType<AdminSaleroomSessionSnapshot>;

const saleroomSessionStatuses = ["none", "pending", "live", "paused", "ended"] as const;

export const adminSaleroomSessionStatusRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminSaleroomSessionStatusRow => {
    const statusRaw = row.status;
    const status =
      typeof statusRaw === "string" &&
      (saleroomSessionStatuses as readonly string[]).includes(statusRaw)
        ? (statusRaw as AdminSaleroomSessionStatusRow["status"])
        : "none";
    return {
      saleId: String(row.saleId ?? ""),
      status,
      currentLotId: row.currentLotId == null ? null : String(row.currentLotId),
    };
  });

export const adminSaleroomSessionsResponseSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminSaleroomSessionStatusRow[] => {
    const sessions = Array.isArray(row.sessions) ? row.sessions : [];
    return sessions.map((session) => adminSaleroomSessionStatusRowSchema.parse(session));
  });

export function parseAdminPaddleRosterEntry(raw: unknown): AdminPaddleRosterEntry {
  return adminPaddleRosterEntrySchema.parse(raw);
}

export function parseAdminSaleroomSessionSnapshot(raw: unknown): AdminSaleroomSessionSnapshot {
  return adminSaleroomSessionSnapshotSchema.parse(raw);
}

type _AdminSaleroomSessionSnapshotInfer = z.infer<typeof adminSaleroomSessionSnapshotSchema>;
const _adminSaleroomSessionSnapshotGuard =
  null as unknown as _AdminSaleroomSessionSnapshotInfer satisfies AdminSaleroomSessionSnapshot;
void _adminSaleroomSessionSnapshotGuard;

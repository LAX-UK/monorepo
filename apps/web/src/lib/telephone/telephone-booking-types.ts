import type { TelephoneBidBooking, TelephoneBidBookingStatus } from "@auction/types";

export type TelephoneBookingSnapshot = {
  id: string;
  saleId: string;
  status: TelephoneBidBookingStatus;
  lotIds: string[];
  authorizedMax: string | null;
  buyerNotes: string | null;
  phoneE164: string;
  limitIncreaseRequestedAt: string | null;
  limitIncreaseAmount: string | null;
  completedLotIds: string[];
  createdAt: string;
  confirmedAt: string | null;
  updatedAt: string;
};

export type TelephoneBookingListItem = TelephoneBookingSnapshot & {
  saleTitle?: string | null;
};

export type TelephoneBookingDetail = TelephoneBookingSnapshot & {
  saleTitle?: string | null;
  linkedBids?: Array<{
    id: string;
    lotId: string;
    amount: string;
    isWinning: boolean;
    createdAt: string;
  }>;
};

export type AdminTelephoneBookingRow = TelephoneBidBooking & {
  userEmail: string | null;
  userName: string | null;
  buyerLegalEntityDisplayName: string | null;
  phoneDisplay: string | null;
};

export type { AdminSaleOperationsSnapshot } from "@/lib/data/http/admin-operations-snapshot.types";
export { parseAdminSaleOperationsSnapshot } from "@/lib/data/http/admin-operations-snapshot.schema";

const BOOKING_STATUSES: readonly TelephoneBidBookingStatus[] = [
  "requested",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

function parseIso(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (raw instanceof Date) return raw.toISOString();
  return null;
}

function parseBookingStatus(raw: unknown): TelephoneBidBookingStatus | null {
  return typeof raw === "string" && BOOKING_STATUSES.includes(raw as TelephoneBidBookingStatus)
    ? (raw as TelephoneBidBookingStatus)
    : null;
}

export function parseTelephoneBookingSnapshot(raw: unknown): TelephoneBookingSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = parseBookingStatus(o.status);
  if (
    !status ||
    typeof o.id !== "string" ||
    typeof o.saleId !== "string" ||
    typeof o.phoneE164 !== "string"
  ) {
    return null;
  }
  const lotIds = Array.isArray(o.lotIds)
    ? o.lotIds.filter((id): id is string => typeof id === "string")
    : [];
  const completedLotIds = Array.isArray(o.completedLotIds)
    ? o.completedLotIds.filter((id): id is string => typeof id === "string")
    : [];
  const createdAt = parseIso(o.createdAt);
  const updatedAt = parseIso(o.updatedAt);
  if (!createdAt || !updatedAt) return null;
  return {
    id: o.id,
    saleId: o.saleId,
    status,
    lotIds,
    authorizedMax: o.authorizedMax == null ? null : String(o.authorizedMax),
    buyerNotes: typeof o.buyerNotes === "string" ? o.buyerNotes : null,
    phoneE164: o.phoneE164,
    limitIncreaseRequestedAt: parseIso(o.limitIncreaseRequestedAt),
    limitIncreaseAmount: o.limitIncreaseAmount == null ? null : String(o.limitIncreaseAmount),
    completedLotIds,
    createdAt,
    confirmedAt: parseIso(o.confirmedAt),
    updatedAt,
  };
}

export function parseTelephoneBookingListItem(raw: unknown): TelephoneBookingListItem | null {
  const base = parseTelephoneBookingSnapshot(raw);
  if (!base) return null;
  const o = raw as Record<string, unknown>;
  return {
    ...base,
    saleTitle: typeof o.saleTitle === "string" ? o.saleTitle : null,
  };
}

export function parseTelephoneBookingDetail(raw: unknown): TelephoneBookingDetail | null {
  const base = parseTelephoneBookingListItem(raw);
  if (!base) return null;
  const o = raw as Record<string, unknown>;
  const linkedBids = Array.isArray(o.linkedBids)
    ? o.linkedBids
        .map((bid) => {
          if (!bid || typeof bid !== "object") return null;
          const b = bid as Record<string, unknown>;
          const createdAt = parseIso(b.createdAt);
          if (
            typeof b.id !== "string" ||
            typeof b.lotId !== "string" ||
            typeof b.amount !== "string" ||
            typeof b.isWinning !== "boolean" ||
            !createdAt
          ) {
            return null;
          }
          return {
            id: b.id,
            lotId: b.lotId,
            amount: b.amount,
            isWinning: b.isWinning,
            createdAt,
          };
        })
        .filter((b): b is NonNullable<typeof b> => b != null)
    : undefined;
  return { ...base, ...(linkedBids ? { linkedBids } : {}) };
}

export function parseAdminTelephoneBookingRow(raw: unknown): AdminTelephoneBookingRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = parseBookingStatus(o.status);
  if (
    !status ||
    typeof o.id !== "string" ||
    typeof o.saleId !== "string" ||
    typeof o.userId !== "string" ||
    typeof o.buyerLegalEntityId !== "string" ||
    typeof o.phoneE164 !== "string"
  ) {
    return null;
  }
  const createdAt = parseIso(o.createdAt);
  const updatedAt = parseIso(o.updatedAt);
  if (!createdAt || !updatedAt) return null;
  const lotIds = Array.isArray(o.lotIds)
    ? o.lotIds.filter((id): id is string => typeof id === "string")
    : [];
  const completedLotIds = Array.isArray(o.completedLotIds)
    ? o.completedLotIds.filter((id): id is string => typeof id === "string")
    : [];
  return {
    id: o.id,
    saleId: o.saleId,
    userId: o.userId,
    buyerLegalEntityId: o.buyerLegalEntityId,
    phoneE164: o.phoneE164,
    lotIds,
    authorizedMax: o.authorizedMax == null ? null : String(o.authorizedMax),
    status,
    clerkUserId: typeof o.clerkUserId === "string" ? o.clerkUserId : null,
    notes: typeof o.notes === "string" ? o.notes : null,
    buyerNotes: typeof o.buyerNotes === "string" ? o.buyerNotes : null,
    approvedByUserId: typeof o.approvedByUserId === "string" ? o.approvedByUserId : null,
    completedLotIds,
    limitIncreaseRequestedAt: o.limitIncreaseRequestedAt
      ? new Date(String(o.limitIncreaseRequestedAt))
      : null,
    limitIncreaseAmount: o.limitIncreaseAmount == null ? null : String(o.limitIncreaseAmount),
    cancelledAt: o.cancelledAt ? new Date(String(o.cancelledAt)) : null,
    cancelledByUserId: typeof o.cancelledByUserId === "string" ? o.cancelledByUserId : null,
    cancellationReason: typeof o.cancellationReason === "string" ? o.cancellationReason : null,
    createdAt: new Date(createdAt),
    confirmedAt: o.confirmedAt ? new Date(String(o.confirmedAt)) : null,
    updatedAt: new Date(updatedAt),
    userEmail: typeof o.userEmail === "string" ? o.userEmail : null,
    userName: typeof o.userName === "string" ? o.userName : null,
    buyerLegalEntityDisplayName:
      typeof o.buyerLegalEntityDisplayName === "string" ? o.buyerLegalEntityDisplayName : null,
    phoneDisplay: typeof o.phoneDisplay === "string" ? o.phoneDisplay : null,
  };
}

export function telephoneBookingStatusLabel(status: TelephoneBidBookingStatus): string {
  switch (status) {
    case "requested":
      return "Requested";
    case "confirmed":
      return "Confirmed";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

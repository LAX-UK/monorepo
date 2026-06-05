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

export type AdminSaleOperationsSnapshot = {
  sale: {
    id: string;
    title: string;
    status: string;
    deliveryMode: string;
    startTime: string | null;
    venueName: string | null;
    streamUrl: string | null;
  };
  saleroomSession: {
    status: string;
    currentLotId: string | null;
    currentLotNumber: number | null;
    currentLotTitle: string | null;
  } | null;
  currentLotBidding: {
    currentPrice: string;
    leaderRef: string | null;
    bidCount: number;
  } | null;
  registrations: { pending: number; approved: number; rejected: number };
  telephoneBookings: {
    requested: number;
    confirmed: number;
    inProgress: number;
    completed: number;
  };
  pendingActions: {
    registrations: Array<{
      id: string;
      status: string;
      userName: string | null;
      userEmail: string | null;
    }>;
    telephone: AdminTelephoneBookingRow[];
  };
};

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

export function parseAdminSaleOperationsSnapshot(raw: unknown): AdminSaleOperationsSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const saleRaw = o.sale;
  if (!saleRaw || typeof saleRaw !== "object") return null;
  const sale = saleRaw as Record<string, unknown>;
  if (typeof sale.id !== "string" || typeof sale.title !== "string") return null;

  const parseSession = (): AdminSaleOperationsSnapshot["saleroomSession"] => {
    const s = o.saleroomSession;
    if (!s || typeof s !== "object") return null;
    const row = s as Record<string, unknown>;
    return {
      status: String(row.status ?? "none"),
      currentLotId: typeof row.currentLotId === "string" ? row.currentLotId : null,
      currentLotNumber: typeof row.currentLotNumber === "number" ? row.currentLotNumber : null,
      currentLotTitle: typeof row.currentLotTitle === "string" ? row.currentLotTitle : null,
    };
  };

  const parseBidding = (): AdminSaleOperationsSnapshot["currentLotBidding"] => {
    const b = o.currentLotBidding;
    if (!b || typeof b !== "object") return null;
    const row = b as Record<string, unknown>;
    return {
      currentPrice: String(row.currentPrice ?? "0"),
      leaderRef: typeof row.leaderRef === "string" ? row.leaderRef : null,
      bidCount: typeof row.bidCount === "number" ? row.bidCount : 0,
    };
  };

  const regs = o.registrations;
  const tel = o.telephoneBookings;
  const pending = o.pendingActions;

  return {
    sale: {
      id: sale.id,
      title: sale.title,
      status: String(sale.status ?? ""),
      deliveryMode: String(sale.deliveryMode ?? ""),
      startTime: parseIso(sale.startTime),
      venueName: typeof sale.venueName === "string" ? sale.venueName : null,
      streamUrl: typeof sale.streamUrl === "string" ? sale.streamUrl : null,
    },
    saleroomSession: parseSession(),
    currentLotBidding: parseBidding(),
    registrations: {
      pending:
        regs && typeof regs === "object"
          ? Number((regs as Record<string, unknown>).pending ?? 0)
          : 0,
      approved:
        regs && typeof regs === "object"
          ? Number((regs as Record<string, unknown>).approved ?? 0)
          : 0,
      rejected:
        regs && typeof regs === "object"
          ? Number((regs as Record<string, unknown>).rejected ?? 0)
          : 0,
    },
    telephoneBookings: {
      requested:
        tel && typeof tel === "object"
          ? Number((tel as Record<string, unknown>).requested ?? 0)
          : 0,
      confirmed:
        tel && typeof tel === "object"
          ? Number((tel as Record<string, unknown>).confirmed ?? 0)
          : 0,
      inProgress:
        tel && typeof tel === "object"
          ? Number((tel as Record<string, unknown>).inProgress ?? 0)
          : 0,
      completed:
        tel && typeof tel === "object"
          ? Number((tel as Record<string, unknown>).completed ?? 0)
          : 0,
    },
    pendingActions: {
      registrations: Array.isArray(
        pending && typeof pending === "object"
          ? (pending as Record<string, unknown>).registrations
          : [],
      )
        ? ((pending as Record<string, unknown>).registrations as unknown[])
            .map((r) => {
              if (!r || typeof r !== "object") return null;
              const row = r as Record<string, unknown>;
              if (typeof row.id !== "string" || typeof row.status !== "string") return null;
              return {
                id: row.id,
                status: row.status,
                userName: typeof row.userName === "string" ? row.userName : null,
                userEmail: typeof row.userEmail === "string" ? row.userEmail : null,
              };
            })
            .filter((r): r is NonNullable<typeof r> => r != null)
        : [],
      telephone: Array.isArray(
        pending && typeof pending === "object"
          ? (pending as Record<string, unknown>).telephone
          : [],
      )
        ? ((pending as Record<string, unknown>).telephone as unknown[])
            .map(parseAdminTelephoneBookingRow)
            .filter((r): r is AdminTelephoneBookingRow => r != null)
        : [],
    },
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

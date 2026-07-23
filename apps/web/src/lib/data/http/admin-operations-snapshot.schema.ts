import type { AdminSaleOperationsSnapshot } from "@/lib/data/http/admin-operations-snapshot.types";
import { parseAdminTelephoneBookingRow } from "@/lib/telephone/telephone-booking-types";
import type { AdminTelephoneBookingRow } from "@/lib/telephone/telephone-booking-types";

function parseIso(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (raw instanceof Date) return raw.toISOString();
  return null;
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

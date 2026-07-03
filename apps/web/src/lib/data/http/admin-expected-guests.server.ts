import type {
  OnsiteEventSegmentOption,
  SaleExpectedGuestRow,
  SaleExpectedGuestsSummary,
} from "@auction/types";
import { authedServerFetch } from "./authed-server-fetch";

export type AdminExpectedGuestRow = SaleExpectedGuestRow;
export type AdminExpectedGuestsSummary = SaleExpectedGuestsSummary;

export function parseAdminExpectedGuestRow(raw: unknown): AdminExpectedGuestRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.rsvpId !== "string" ||
    typeof row.userId !== "string" ||
    typeof row.email !== "string" ||
    typeof row.attendanceSegment !== "string"
  ) {
    return null;
  }
  const eligibleEntities = Array.isArray(row.eligibleEntities)
    ? row.eligibleEntities
        .map((entity) => {
          if (typeof entity !== "object" || entity === null) return null;
          const e = entity as Record<string, unknown>;
          if (typeof e.id !== "string" || typeof e.displayName !== "string") return null;
          return {
            id: e.id,
            displayName: e.displayName,
            role: typeof e.role === "string" ? e.role : "",
            kind: typeof e.kind === "string" ? e.kind : "",
            existingRegistration:
              e.existingRegistration && typeof e.existingRegistration === "object"
                ? {
                    status: String(
                      (e.existingRegistration as Record<string, unknown>).status ?? "",
                    ),
                    paddleNumber:
                      typeof (e.existingRegistration as Record<string, unknown>).paddleNumber ===
                      "number"
                        ? ((e.existingRegistration as Record<string, unknown>)
                            .paddleNumber as number)
                        : null,
                    bidLimit:
                      typeof (e.existingRegistration as Record<string, unknown>).bidLimit ===
                      "string"
                        ? ((e.existingRegistration as Record<string, unknown>).bidLimit as string)
                        : null,
                    checkedInAt:
                      typeof (e.existingRegistration as Record<string, unknown>).checkedInAt ===
                      "string"
                        ? ((e.existingRegistration as Record<string, unknown>)
                            .checkedInAt as string)
                        : null,
                  }
                : null,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e != null)
    : [];

  const saleRegistration =
    row.saleRegistration && typeof row.saleRegistration === "object"
      ? {
          registrationId: String(
            (row.saleRegistration as Record<string, unknown>).registrationId ?? "",
          ),
          status: String((row.saleRegistration as Record<string, unknown>).status ?? ""),
          paddleNumber:
            typeof (row.saleRegistration as Record<string, unknown>).paddleNumber === "number"
              ? ((row.saleRegistration as Record<string, unknown>).paddleNumber as number)
              : null,
          checkedInAt:
            typeof (row.saleRegistration as Record<string, unknown>).checkedInAt === "string"
              ? ((row.saleRegistration as Record<string, unknown>).checkedInAt as string)
              : null,
        }
      : null;

  return {
    rsvpId: row.rsvpId,
    userId: row.userId,
    name: typeof row.name === "string" ? row.name : null,
    email: row.email,
    attendanceSegment: row.attendanceSegment,
    galaCheckedInAt: typeof row.galaCheckedInAt === "string" ? row.galaCheckedInAt : null,
    plusOne: typeof row.plusOne === "number" ? row.plusOne : 0,
    kycApproved: row.kycApproved === true,
    emailVerified: row.emailVerified === true,
    suspended: row.suspended === true,
    eligibleEntities,
    saleRegistration: saleRegistration?.registrationId ? saleRegistration : null,
  };
}

export async function getAdminExpectedGuests(saleId: string): Promise<AdminExpectedGuestsSummary> {
  const res = await authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/expected-guests`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error("Could not load expected guests");
  }
  const json = (await res.json()) as { data?: unknown };
  const data = json.data;
  if (typeof data !== "object" || data === null) {
    return {
      eventSlug: null,
      eventTitle: null,
      segmentOptions: [],
      items: [],
      counts: { rsvped: 0, galaCheckedIn: 0, salePresent: 0, paddled: 0 },
    };
  }
  const payload = data as Record<string, unknown>;
  const items = Array.isArray(payload.items)
    ? payload.items
        .map((row) => parseAdminExpectedGuestRow(row))
        .filter((row): row is AdminExpectedGuestRow => row != null)
    : [];
  const countsRaw =
    typeof payload.counts === "object" && payload.counts !== null
      ? (payload.counts as Record<string, unknown>)
      : null;
  const counts = {
    rsvped: typeof countsRaw?.rsvped === "number" ? countsRaw.rsvped : items.length,
    galaCheckedIn:
      typeof countsRaw?.galaCheckedIn === "number"
        ? countsRaw.galaCheckedIn
        : items.filter((row) => row.galaCheckedInAt != null).length,
    salePresent:
      typeof countsRaw?.salePresent === "number"
        ? countsRaw.salePresent
        : items.filter((row) => row.saleRegistration?.checkedInAt != null).length,
    paddled:
      typeof countsRaw?.paddled === "number"
        ? countsRaw.paddled
        : items.filter((row) => row.saleRegistration?.paddleNumber != null).length,
  };
  const segmentOptions = parseSegmentOptions(payload.segmentOptions);
  return {
    eventSlug: typeof payload.eventSlug === "string" ? payload.eventSlug : null,
    eventTitle: typeof payload.eventTitle === "string" ? payload.eventTitle : null,
    segmentOptions,
    items,
    counts,
  };
}

function parseSegmentOptions(value: unknown): OnsiteEventSegmentOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.value !== "string" || typeof row.label !== "string") return [];
    return [
      {
        value: row.value,
        label: row.label,
        ...(typeof row.helper === "string" ? { helper: row.helper } : {}),
      },
    ];
  });
}

import type { AdminSaleReadinessRowDto } from "@auction/validators";

export type AdminSaleReadinessRow = AdminSaleReadinessRowDto;

function parseString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseBlockers(raw: unknown): AdminSaleReadinessRow["blockers"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const o = entry as Record<string, unknown>;
      const id = parseString(o.id);
      const label = parseString(o.label);
      const href = parseString(o.href);
      if (!id || !label || !href) return null;
      return {
        id,
        label,
        href,
        count: typeof o.count === "number" ? o.count : undefined,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b != null);
}

export function parseAdminSaleReadinessRow(raw: unknown): AdminSaleReadinessRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const saleId = parseString(o.saleId);
  const title = parseString(o.title);
  const href = parseString(o.href);
  if (!saleId || !title || !href) return null;
  return {
    saleId,
    title,
    href,
    status: String(o.status ?? ""),
    deliveryMode: String(o.deliveryMode ?? ""),
    startTime: parseString(o.startTime),
    daysToStart: typeof o.daysToStart === "number" ? o.daysToStart : null,
    lotsTotal: typeof o.lotsTotal === "number" ? o.lotsTotal : 0,
    lotsPublished: typeof o.lotsPublished === "number" ? o.lotsPublished : 0,
    lotsDraft: typeof o.lotsDraft === "number" ? o.lotsDraft : 0,
    lotsMissingPhotos: typeof o.lotsMissingPhotos === "number" ? o.lotsMissingPhotos : 0,
    lotsMissingEstimates: typeof o.lotsMissingEstimates === "number" ? o.lotsMissingEstimates : 0,
    pendingRegistrations: typeof o.pendingRegistrations === "number" ? o.pendingRegistrations : 0,
    pendingTelephoneBookings:
      typeof o.pendingTelephoneBookings === "number" ? o.pendingTelephoneBookings : 0,
    sessionStatus: parseString(o.sessionStatus),
    blockers: parseBlockers(o.blockers),
    consoleHref: parseString(o.consoleHref),
  };
}

export function parseAdminSaleReadinessItems(raw: unknown): AdminSaleReadinessRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parseAdminSaleReadinessRow)
    .filter((row): row is AdminSaleReadinessRow => row != null);
}

import {
  type ConnectRequiredByLotId,
  lotConnectRequired,
} from "@/lib/admin/connect-readiness-shared";
import {
  connectPublishBlockedTitle,
  draftSaleLotPublishBanner,
} from "@/lib/admin/sale-setup/field-copy";
import type { Lot } from "@auction/types";

export type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";

export type BulkLotErrorEntry = {
  lotId: string;
  message: string;
  code?: string;
};

export type BulkLotsActionResult = {
  attempted: number;
  failed: number;
  succeeded: number;
  errors: BulkLotErrorEntry[];
  orphanDraftSales?: Array<{ id: string; title: string }>;
};

function parseBulkLotErrorEntry(raw: unknown): BulkLotErrorEntry | null {
  if (typeof raw === "string") {
    const match = /^([^:]+):\s*(.+)$/.exec(raw.trim());
    if (match) {
      return { lotId: match[1] ?? "", message: match[2] ?? raw };
    }
    return { lotId: "", message: raw };
  }
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.message !== "string") return null;
  return {
    lotId: typeof row.lotId === "string" ? row.lotId : "",
    message: row.message,
    ...(typeof row.code === "string" ? { code: row.code } : {}),
  };
}

export function parseBulkLotsApiResponse(body: unknown): BulkLotsActionResult | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const attempted = typeof row.attempted === "number" ? row.attempted : 0;
  const failed = typeof row.failed === "number" ? row.failed : 0;
  const rawErrors = Array.isArray(row.errors) ? row.errors : [];
  const errors = rawErrors
    .map(parseBulkLotErrorEntry)
    .filter((entry): entry is BulkLotErrorEntry => entry != null);
  const rawOrphans = Array.isArray(row.orphanDraftSales) ? row.orphanDraftSales : [];
  const orphanDraftSales = rawOrphans
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const o = raw as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.title !== "string") return null;
      return { id: o.id, title: o.title };
    })
    .filter((o): o is { id: string; title: string } => o != null);
  return {
    attempted,
    failed,
    succeeded: Math.max(0, attempted - failed),
    errors,
    ...(orphanDraftSales.length > 0 ? { orphanDraftSales } : {}),
  };
}

export function bulkLotsFailureMessage(result: BulkLotsActionResult): string {
  const first = result.errors[0];
  if (first?.code === "connect_required") {
    return connectPublishBlockedTitle();
  }
  if (first?.code === "use_sale_publish") {
    return "Lots in a draft sale are published together when you publish the sale.";
  }
  if (first?.message) return first.message;
  return "Bulk action failed for all selected lots";
}

export function bulkLotsPartialSuccessMessage(
  operationLabel: string,
  result: BulkLotsActionResult,
): string {
  const verb = operationLabel.toLowerCase();
  const base = `${result.succeeded} of ${result.attempted} ${verb}`;
  const first = result.errors[0];
  if (!first) return base;
  if (first.code === "connect_required") {
    return `${base}. ${connectPublishBlockedTitle()}.`;
  }
  if (first.code === "use_sale_publish") {
    return `${base}. Lots in a draft sale are published together when you publish the sale.`;
  }
  return `${base}. ${first.message}`;
}

export function bulkLotsHasConnectRequired(result: BulkLotsActionResult): boolean {
  return result.errors.some((e) => e.code === "connect_required");
}

export function bulkLotsHasUseSalePublish(result: BulkLotsActionResult): boolean {
  return result.errors.some((e) => e.code === "use_sale_publish");
}

/** Client-side hint before bulk publish when selection likely to fail. */
export function bulkPublishPreflightWarning(
  selectedIds: readonly string[],
  lots: readonly Lot[],
  connectRequiredByLotId?: ConnectRequiredByLotId,
): string | null {
  if (selectedIds.length === 0) return null;
  const selected = new Set(selectedIds);
  const hints: string[] = [];
  let connectBlocked = 0;
  let saleAssigned = 0;
  for (const lot of lots) {
    if (!selected.has(lot.id)) continue;
    if (lotConnectRequired(connectRequiredByLotId, lot.id)) connectBlocked++;
    if (lot.saleId) saleAssigned++;
  }
  if (connectBlocked > 0) {
    hints.push(
      connectBlocked === 1
        ? "1 selected lot requires seller payout setup before scheduling"
        : `${connectBlocked} selected lots require seller payout setup before scheduling`,
    );
  }
  if (saleAssigned > 0) {
    hints.push(draftSaleLotPublishBanner());
  }
  return hints.length > 0 ? hints.join(". ") : null;
}

/** Client-side hint before bulk delete when selection includes ineligible lots. */
export function bulkLotDeletePreflightWarning(
  selectedIds: readonly string[],
  rows: readonly { id: string; canDelete: boolean }[],
): string | null {
  if (selectedIds.length === 0) return null;
  const selected = new Set(selectedIds);
  let blocked = 0;
  for (const row of rows) {
    if (!selected.has(row.id)) continue;
    if (!row.canDelete) blocked++;
  }
  if (blocked === 0) return null;
  return blocked === 1
    ? "1 selected lot cannot be deleted — it may be live, blocked, or missing auction.manage eligibility."
    : `${blocked} selected lots cannot be deleted — they may be live, blocked, or missing eligibility.`;
}

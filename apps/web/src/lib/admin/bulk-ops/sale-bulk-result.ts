export type BulkSaleErrorEntry = {
  saleId: string;
  message: string;
  blockers?: string[];
};

export type BulkSalesActionResult = {
  attempted: number;
  failed: number;
  succeeded: number;
  errors: BulkSaleErrorEntry[];
};

function parseBulkSaleErrorEntry(raw: unknown): BulkSaleErrorEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.message !== "string") return null;
  return {
    saleId: typeof row.saleId === "string" ? row.saleId : "",
    message: row.message,
    ...(Array.isArray(row.blockers)
      ? { blockers: row.blockers.filter((b): b is string => typeof b === "string") }
      : {}),
  };
}

export function parseBulkSalesApiResponse(body: unknown): BulkSalesActionResult | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const attempted = typeof row.attempted === "number" ? row.attempted : 0;
  const failed = typeof row.failed === "number" ? row.failed : 0;
  const rawErrors = Array.isArray(row.errors) ? row.errors : [];
  const errors = rawErrors
    .map(parseBulkSaleErrorEntry)
    .filter((entry): entry is BulkSaleErrorEntry => entry != null);
  return {
    attempted,
    failed,
    succeeded: Math.max(0, attempted - failed),
    errors,
  };
}

export function bulkSalesFailureMessage(result: BulkSalesActionResult): string {
  const first = result.errors[0];
  if (first?.message) return first.message;
  return "Bulk action failed for all selected sales";
}

export function bulkSalesPartialSuccessMessage(
  operationLabel: string,
  result: BulkSalesActionResult,
): string {
  const verb = operationLabel.toLowerCase();
  const base = `${result.succeeded} of ${result.attempted} ${verb}`;
  const first = result.errors[0];
  if (!first) return base;
  return `${base}. ${first.message}`;
}

/** Client-side hint before bulk delete when selection includes ineligible sales. */
export function bulkSaleDeletePreflightWarning(
  selectedIds: readonly string[],
  rows: readonly { saleId: string; canDelete: boolean }[],
): string | null {
  if (selectedIds.length === 0) return null;
  const selected = new Set(selectedIds);
  let blocked = 0;
  for (const row of rows) {
    if (!selected.has(row.saleId)) continue;
    if (!row.canDelete) blocked++;
  }
  if (blocked === 0) return null;
  return blocked === 1
    ? "1 selected sale cannot be deleted — it may be live or have blocking registrations."
    : `${blocked} selected sales cannot be deleted — they may be live or have blocking registrations.`;
}

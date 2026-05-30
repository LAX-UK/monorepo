import {
  type BulkLotsActionResult,
  bulkLotsFailureMessage,
  bulkLotsHasConnectRequired,
  bulkLotsHasUseSalePublish,
  bulkLotsPartialSuccessMessage,
} from "@/lib/admin/bulk-ops/lot-bulk-result";
import type { ActionResult } from "@/lib/forms/form-result";

export type SequentialBulkResult = {
  attempted: number;
  failed: number;
  succeeded: number;
  errors: { id: string; message: string }[];
};

export function isBulkLotsResult(data: unknown): data is BulkLotsActionResult {
  if (!data || typeof data !== "object") return false;
  const row = data as Record<string, unknown>;
  return typeof row.attempted === "number" && typeof row.failed === "number";
}

export function toSequentialBulkResult(ids: string[], failures: string[]): SequentialBulkResult {
  return {
    attempted: ids.length,
    failed: failures.length,
    succeeded: Math.max(0, ids.length - failures.length),
    errors: failures.map((id) => ({ id, message: "Operation failed" })),
  };
}

export function sequentialBulkPartialMessage(
  operationLabel: string,
  result: SequentialBulkResult,
): string {
  const verb = operationLabel.toLowerCase();
  return `${result.succeeded} of ${result.attempted} ${verb}`;
}

export function sequentialBulkFailureMessage(result: SequentialBulkResult): string {
  return `Bulk action failed for ${result.failed} of ${result.attempted} item(s). Refresh and retry.`;
}

type BulkNotifyArgs = {
  operationLabel: string;
  result: ActionResult<unknown>;
  onPartialClear: () => void;
  refresh: () => void;
};

/** Unified bulk action result handling for lots (structured API) and sales (sequential). */
export function handleBulkActionResult({
  operationLabel,
  result,
  onPartialClear: _onPartialClear,
  refresh: _refresh,
}: BulkNotifyArgs): {
  ok: boolean;
  message: string;
  variant: "success" | "warning" | "error";
  shouldClear: boolean;
  shouldRefresh: boolean;
} {
  if (!result.ok) {
    const bulkMeta = result.meta?.bulk;
    if (isBulkLotsResult(bulkMeta)) {
      return {
        ok: false,
        message: bulkLotsFailureMessage(bulkMeta),
        variant: "error",
        shouldClear: bulkMeta.succeeded > 0,
        shouldRefresh: bulkMeta.succeeded > 0,
      };
    }
    const seq = result.meta?.sequential as SequentialBulkResult | undefined;
    if (seq && seq.succeeded > 0) {
      return {
        ok: false,
        message: result.error,
        variant: "error",
        shouldClear: true,
        shouldRefresh: true,
      };
    }
    return {
      ok: false,
      message: result.error,
      variant: "error",
      shouldClear: false,
      shouldRefresh: false,
    };
  }

  const bulk = isBulkLotsResult(result.data) ? result.data : null;
  if (bulk && bulk.failed > 0) {
    const message =
      bulkLotsHasConnectRequired(bulk) || bulkLotsHasUseSalePublish(bulk)
        ? bulkLotsPartialSuccessMessage(operationLabel, bulk)
        : bulkLotsPartialSuccessMessage(operationLabel, bulk);
    return {
      ok: true,
      message,
      variant: "warning",
      shouldClear: true,
      shouldRefresh: true,
    };
  }

  const seq = result.data as SequentialBulkResult | undefined;
  if (seq && typeof seq === "object" && seq.failed > 0) {
    return {
      ok: true,
      message: sequentialBulkPartialMessage(operationLabel, seq),
      variant: "warning",
      shouldClear: true,
      shouldRefresh: true,
    };
  }

  return {
    ok: true,
    message: `${operationLabel} complete`,
    variant: "success",
    shouldClear: true,
    shouldRefresh: true,
  };
}

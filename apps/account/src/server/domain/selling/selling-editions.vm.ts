import { formatDate } from "@/lib/format-money";
import type { PortalSaleAuthority, PortalSaleAuthorityRequest } from "@auction/shop-contracts";

/** Shop accepts a request for between 0 and 10 editions available to sell. */
export const MIN_AVAILABLE_TO_SELL = 0;
export const MAX_AVAILABLE_TO_SELL = 10;
/** The longest note the request dialog accepts. */
export const SALE_REQUEST_NOTE_MAX = 500;

/**
 * Shop's counts for one artwork, in the words a seller uses. Shop counts the editions listed for
 * sale and not yet taken (`authorisedCount`) apart from the ones sold or reserved
 * (`committedCount`), so what LAX approved is the two together and what can sell now is the
 * listed ones: approved minus sold or reserved.
 */
export function editionCounts(
  row: Pick<PortalSaleAuthority, "authorisedCount" | "committedCount">,
) {
  const availableNow = Math.max(0, row.authorisedCount);
  const soldOrReserved = Math.max(0, row.committedCount);
  return { approved: availableNow + soldOrReserved, soldOrReserved, availableNow };
}

/** "3 more", "2 fewer" or "no change", against what is available now. */
export function describeChange(requested: number, availableNow: number): string {
  const delta = requested - availableNow;
  if (delta > 0) return `${delta} more`;
  if (delta < 0) return `${-delta} fewer`;
  return "no change";
}

export type PendingRequestVm = {
  requestId: string;
  /** "Request pending: 3 more · sent 12 Oct 2026". */
  summary: string;
  note: string | null;
};

export type EditionRowVm = {
  artworkId: string;
  title: string;
  approved: number;
  soldOrReserved: number;
  availableNow: number;
  lastApprovedOn: string | null;
  pending: PendingRequestVm | null;
  /** Opens the request dialog; absent while a request is pending, because Shop takes one at a time. */
  action: { label: "Request more" | "Change"; current: number } | null;
};

export type RequestHistoryVm = {
  requestId: string;
  title: string;
  outcome: "Approved" | "Declined" | "Withdrawn";
  tone: "success" | "danger" | "neutral";
  /** "Asked for 5 available · sent 12 Oct 2026 · answered 14 Oct 2026". */
  detail: string;
  note: string | null;
  /** Why LAX declined the request, in their words; null otherwise. */
  declineReason: string | null;
};

export type EditionsPageVm = {
  rows: EditionRowVm[];
  history: RequestHistoryVm[];
  totals: {
    availableNow: number;
    soldOrReserved: number;
    artworks: number;
    /** Requests LAX has not answered yet. */
    pendingRequests: number;
  };
};

const OUTCOMES: Record<string, Pick<RequestHistoryVm, "outcome" | "tone">> = {
  approved: { outcome: "Approved", tone: "success" },
  rejected: { outcome: "Declined", tone: "danger" },
  cancelled: { outcome: "Withdrawn", tone: "neutral" },
};

function latestPendingByArtwork(requests: readonly PortalSaleAuthorityRequest[]) {
  const pending = new Map<string, PortalSaleAuthorityRequest>();
  for (const request of requests) {
    if (request.status !== "pending") continue;
    const seen = pending.get(request.artworkId);
    if (!seen || seen.createdAt < request.createdAt) pending.set(request.artworkId, request);
  }
  return pending;
}

function cleanNote(note: string | null): string | null {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}

/**
 * The "Editions you can sell" page: one row per artwork with its counts and either the pending
 * request or the action to make one, then the requests already answered, newest first.
 */
export function buildEditionsPage(
  editions: readonly PortalSaleAuthority[],
  requests: readonly PortalSaleAuthorityRequest[],
): EditionsPageVm {
  const pending = latestPendingByArtwork(requests);
  const rows = editions.map((row): EditionRowVm => {
    const counts = editionCounts(row);
    const request = pending.get(row.artworkId);
    return {
      artworkId: row.artworkId,
      title: row.artworkTitle,
      ...counts,
      lastApprovedOn: row.lastGrantAt ? formatDate(row.lastGrantAt) : null,
      pending: request
        ? {
            requestId: request.requestId,
            summary: `Request pending: ${describeChange(request.requestedCount, counts.availableNow)} · sent ${formatDate(request.createdAt)}`,
            note: cleanNote(request.note),
          }
        : null,
      action: request
        ? null
        : {
            label: counts.availableNow >= MAX_AVAILABLE_TO_SELL ? "Change" : "Request more",
            current: counts.availableNow,
          },
    };
  });

  const history = requests
    .filter((request) => request.status !== "pending" && OUTCOMES[request.status])
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((request): RequestHistoryVm => {
      const outcome = OUTCOMES[request.status] as Pick<RequestHistoryVm, "outcome" | "tone">;
      const parts = [
        `Asked for ${request.requestedCount} available to sell`,
        `sent ${formatDate(request.createdAt)}`,
      ];
      if (request.handledAt) {
        parts.push(
          `${outcome.outcome === "Withdrawn" ? "withdrawn" : "answered"} ${formatDate(request.handledAt)}`,
        );
      }
      return {
        requestId: request.requestId,
        title: request.artworkTitle,
        ...outcome,
        detail: parts.join(" · "),
        note: cleanNote(request.note),
        declineReason:
          request.status === "rejected" ? cleanNote(request.declineReason ?? null) : null,
      };
    });

  return {
    rows,
    history,
    totals: {
      availableNow: rows.reduce((sum, row) => sum + row.availableNow, 0),
      soldOrReserved: rows.reduce((sum, row) => sum + row.soldOrReserved, 0),
      artworks: rows.length,
      pendingRequests: rows.filter((row) => row.pending !== null).length,
    },
  };
}

export type SaleRequestDraftVm = {
  /** The dialog's title, which follows the direction of the change. */
  title: string;
  /** "3 more than now" under the stepper. */
  changeText: string;
  canSubmit: boolean;
  submitLabel: string;
};

/** What the request dialog says for a chosen number, against what is available now. */
export function describeSaleRequestDraft(
  requested: number,
  availableNow: number,
): SaleRequestDraftVm {
  const delta = requested - availableNow;
  const changeText =
    delta === 0 ? "The same as now" : `${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} than now`;
  return {
    title: delta < 0 ? "Sell fewer editions" : "Request more editions",
    changeText,
    canSubmit:
      delta !== 0 && requested >= MIN_AVAILABLE_TO_SELL && requested <= MAX_AVAILABLE_TO_SELL,
    submitLabel: "Send request",
  };
}

/** Keeps a typed number inside what Shop accepts. */
export function clampAvailableToSell(value: number): number {
  if (!Number.isFinite(value)) return MIN_AVAILABLE_TO_SELL;
  return Math.min(MAX_AVAILABLE_TO_SELL, Math.max(MIN_AVAILABLE_TO_SELL, Math.round(value)));
}

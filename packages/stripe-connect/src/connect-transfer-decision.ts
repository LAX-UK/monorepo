/**
 * Stripe forgets idempotency keys after 24 hours, so a payout retried later cannot rely on its key
 * to avoid a second transfer. Every caller that is about to send a payout's transfer asks this
 * module first. It looks at what Stripe already holds for the payout and answers with exactly one
 * of three things, so the three callers can never disagree about paying a seller twice.
 */

/** The parts of a Stripe transfer the decision reads. */
export type ExistingTransferLike = {
  id: string;
  destination?: unknown;
  reversed?: boolean;
  amount?: number | undefined;
  amount_reversed?: number;
  currency?: string;
  metadata?: Record<string, string> | null;
};

export type TransferListParams = {
  transfer_group?: string;
  created?: { gte: number };
  limit: number;
  starting_after?: string;
};

export type ConnectTransferListClient = {
  transfers: {
    list(params: TransferListParams): Promise<{ data: ExistingTransferLike[]; has_more?: boolean }>;
  };
};

export type ConnectTransferBlockReason =
  /** Two or more transfers for the payout are live: one of them may be a duplicate. */
  | "multiple_live_transfers"
  | "amount_mismatch"
  | "destination_mismatch"
  | "currency_mismatch"
  /** Part of the transfer was reversed, so the seller's net position is unclear. */
  | "partially_reversed"
  /** A transfer in the payout's group names a different payout. */
  | "payout_metadata_mismatch"
  /** Stripe has more transfers than we are willing to scan, so we cannot rule one out. */
  | "transfer_listing_incomplete";

export type ConnectTransferDecision =
  | { kind: "adopt"; transfer: { id: string } }
  | { kind: "create" }
  | { kind: "block"; reason: ConnectTransferBlockReason; transferIds: string[] };

export type ConnectTransferDecisionInput = {
  transferGroup: string;
  payoutId: string;
  destinationAccountId: string;
  /** The payout's net amount in minor units (pence). */
  amountMinor: number;
  currency: string;
  /**
   * When the payout was created (unix seconds). A legacy transfer cannot predate it, so the
   * metadata fallback only scans from here.
   */
  createdAfterUnix?: number;
};

const PAGE_SIZE = 100;
/** 100 pages of 100: past this we block rather than guess. */
const MAX_PAGES = 100;

function destinationId(destination: unknown): string | null {
  if (typeof destination === "string") return destination;
  const id = (destination as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" ? id : null;
}

function isFullyReversed(t: ExistingTransferLike): boolean {
  if (t.reversed === true) return true;
  return (
    typeof t.amount === "number" &&
    t.amount > 0 &&
    typeof t.amount_reversed === "number" &&
    t.amount_reversed >= t.amount
  );
}

/** Reads every page of a listing. Returns `complete: false` if the page cap was reached. */
async function listAll(
  client: ConnectTransferListClient,
  base: Omit<TransferListParams, "limit" | "starting_after">,
): Promise<{ transfers: ExistingTransferLike[]; complete: boolean }> {
  const transfers: ExistingTransferLike[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await client.transfers.list({
      ...base,
      limit: PAGE_SIZE,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    transfers.push(...res.data);
    const last = res.data[res.data.length - 1];
    if (!res.has_more) return { transfers, complete: true };
    if (!last) return { transfers, complete: false };
    startingAfter = last.id;
  }
  return { transfers, complete: false };
}

/**
 * Decides what to do about a payout's Stripe transfer.
 *
 * - `adopt`: exactly one live (not fully reversed) transfer, to the right account, in the right
 *   currency, for the payout's amount. Use it; do not create another.
 * - `create`: no live transfer exists. Safe to create.
 * - `block`: anything else. Never create; a person has to look.
 *
 * Transfers are found by the payout's deterministic `transfer_group` (every page). Transfers made
 * before the group existed carry only `metadata.payoutId`, so when the group holds no live transfer
 * the transfers created since the payout began are scanned for that metadata.
 */
export async function decideConnectTransfer(
  client: ConnectTransferListClient,
  input: ConnectTransferDecisionInput,
): Promise<ConnectTransferDecision> {
  const grouped = await listAll(client, { transfer_group: input.transferGroup });
  let candidates = grouped.transfers;
  let complete = grouped.complete;

  if (complete && !candidates.some((t) => !isFullyReversed(t))) {
    const legacy = await listAll(client, {
      ...(input.createdAfterUnix !== undefined ? { created: { gte: input.createdAfterUnix } } : {}),
    });
    complete = legacy.complete;
    const known = new Set(candidates.map((t) => t.id));
    candidates = [
      ...candidates,
      ...legacy.transfers.filter(
        (t) => t.metadata?.payoutId === input.payoutId && !known.has(t.id),
      ),
    ];
  }

  const live = candidates.filter((t) => !isFullyReversed(t));
  const liveIds = live.map((t) => t.id);

  if (!complete) {
    return { kind: "block", reason: "transfer_listing_incomplete", transferIds: liveIds };
  }
  if (live.length === 0) return { kind: "create" };

  const block = (reason: ConnectTransferBlockReason): ConnectTransferDecision => ({
    kind: "block",
    reason,
    transferIds: liveIds,
  });

  const [only] = live;
  if (live.length > 1 || !only) return block("multiple_live_transfers");
  if (only.metadata?.payoutId !== undefined && only.metadata.payoutId !== input.payoutId) {
    return block("payout_metadata_mismatch");
  }
  if (typeof only.amount_reversed === "number" && only.amount_reversed > 0) {
    return block("partially_reversed");
  }
  if (destinationId(only.destination) !== input.destinationAccountId) {
    return block("destination_mismatch");
  }
  if (only.currency?.toLowerCase() !== input.currency.toLowerCase()) {
    return block("currency_mismatch");
  }
  if (only.amount !== input.amountMinor) return block("amount_mismatch");
  return { kind: "adopt", transfer: { id: only.id } };
}

/** The text stored on a blocked payout, so staff see why and which transfers to compare. */
export function connectTransferBlockMessage(
  decision: Extract<ConnectTransferDecision, { kind: "block" }>,
): string {
  const ids = decision.transferIds.length > 0 ? ` (${decision.transferIds.join(", ")})` : "";
  return `transfer_blocked: ${decision.reason}${ids}`;
}

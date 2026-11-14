import type { SaleLotCardVM } from "@/lib/marketing/saleroom/view-models";

/**
 * The parts of a sale catalogue card that bidding moves (CO-7): the price line and its clock, the
 * status, the close, the result. The sale page is built from cached reads, so the server draws
 * these as placeholders (`pendingCardVM`) and the browser fills them from a no-store read of the
 * same catalogue page (`useSaleCatalogueLive`).
 */
export const LIVE_CARD_FIELDS = [
  "currentBidLabel",
  "currentBidValue",
  "cardLine",
  "closingLabel",
  "closingShort",
  "isLive",
  "status",
  "endTime",
  "winnerId",
  "hasWinner",
  "resultPending",
] as const satisfies readonly (keyof SaleLotCardVM)[];

export type LiveCardFields = Pick<SaleLotCardVM, (typeof LIVE_CARD_FIELDS)[number]>;

/** The card with its bid state replaced by neutral placeholders, marked `pending`. */
export function pendingCardVM(card: SaleLotCardVM): SaleLotCardVM {
  const { hasWinner: _hasWinner, resultPending: _resultPending, ...rest } = card;
  return {
    ...rest,
    pending: true,
    currentBidLabel: "",
    currentBidValue: "",
    cardLine: { label: "", value: null, time: "none", startsAt: null, endsAt: null },
    closingLabel: null,
    closingShort: null,
    isLive: false,
    status: "scheduled",
    endTime: null,
    winnerId: null,
  };
}

/** The live fields of a freshly mapped card, to lay over the placeholder. */
export function liveCardFields(card: SaleLotCardVM): LiveCardFields {
  return {
    currentBidLabel: card.currentBidLabel,
    currentBidValue: card.currentBidValue,
    cardLine: card.cardLine,
    closingLabel: card.closingLabel,
    closingShort: card.closingShort,
    isLive: card.isLive,
    status: card.status,
    endTime: card.endTime,
    winnerId: card.winnerId,
    ...(card.hasWinner !== undefined ? { hasWinner: card.hasWinner } : {}),
    ...(card.resultPending ? { resultPending: true } : {}),
  };
}

/** The placeholder card filled from the live read; a card the read did not return stays pending. */
export function withLiveCardFields(
  card: SaleLotCardVM,
  live: ReadonlyMap<string, LiveCardFields> | null,
): SaleLotCardVM {
  const fields = live?.get(card.id);
  if (!card.pending || !fields) return card;
  const { pending: _pending, ...rest } = card;
  return { ...rest, ...fields };
}

/** One catalogue page the server read for the cards, repeated live in the browser. */
export type SaleCatalogueLiveRead = { limit: number; offset: number; sort: string };

/** The catalogue pages behind the cards: the same pages the server read (`loadShell`). */
export function saleCatalogueLiveReads(input: {
  loadAll: boolean;
  page: number;
  pageSize: number;
  sort: string;
  total: number;
  loadAllBatch: number;
  loadAllCap: number;
}): SaleCatalogueLiveRead[] {
  if (!input.loadAll) {
    const limit = Math.min(Math.max(input.pageSize, 1), 48);
    return [{ limit, offset: (Math.max(input.page, 1) - 1) * limit, sort: input.sort }];
  }
  const cap = Math.min(input.loadAllCap, input.total);
  const pages = Math.max(1, Math.ceil(cap / input.loadAllBatch));
  return Array.from({ length: pages }, (_, i) => ({
    limit: input.loadAllBatch,
    offset: i * input.loadAllBatch,
    sort: input.sort,
  }));
}

import { collectHref } from "@/lib/collect/collect-links";
import { COLLECT_LIST_COPY } from "@/lib/collect/collect-list-copy";
import { MAX_LOTS_PER_COLLECTION, formatCollectionDay } from "@auction/domain";
import type { PurchaseCollectByState, StorageState } from "@auction/domain";

/** A row's collection badge: what the shared status badge draws. */
export type CollectionBadgeVm = {
  state: "booked" | PurchaseCollectByState;
  label: string;
  tone: "info" | "neutral" | "warning" | "danger";
  shape: "dot" | "ring";
  /** The full sentence, as text for assistive technology and as the hover title. */
  title: string;
};

/**
 * The badge a purchase row wears for collection: `Booked <day>` while a live visit holds it,
 * otherwise `Collect by <day>` or `Overdue since <day>` from the collect-by notice the API worked out
 * (under storage terms, its badge: `Collect by <day> · Storage <amount> so far` once charges run). A booked
 * lot has no notice (it is no longer awaiting collection), so the two never meet. Every label keeps
 * its day as visible text, so nothing hangs on the hover title (which touch screens never show).
 */
export function collectionBadge(input: {
  collectBy: {
    day: string;
    state: PurchaseCollectByState;
    /** The badge under the place's storage terms (day, and the total once owed); wins when present. */
    storage?: { badge: string; state: StorageState } | null;
  } | null;
  /** The start (ISO) of the live visit the lot is booked into. */
  bookedStart: string | null;
  now: Date;
}): CollectionBadgeVm | null {
  if (input.bookedStart) {
    const start = new Date(input.bookedStart);
    if (!Number.isNaN(start.getTime())) {
      const day = formatCollectionDay(start, input.now);
      return {
        state: "booked",
        label: COLLECT_LIST_COPY.badge.booked(day),
        tone: "info",
        shape: "dot",
        title: COLLECT_LIST_COPY.badge.bookedSentence(day),
      };
    }
  }
  const { collectBy } = input;
  if (!collectBy) return null;
  const { storage } = collectBy;
  if (collectBy.state === "overdue") {
    return {
      state: "overdue",
      label: storage?.badge ?? COLLECT_LIST_COPY.badge.overdue(collectBy.day),
      tone: "danger",
      shape: "dot",
      title: storage ? `${storage.badge}.` : COLLECT_LIST_COPY.badge.overdueSentence(collectBy.day),
    };
  }
  return {
    state: collectBy.state,
    label: storage?.badge ?? COLLECT_LIST_COPY.badge.collectBy(collectBy.day),
    tone: collectBy.state === "soon" ? "warning" : "neutral",
    shape: "ring",
    title: storage ? `${storage.badge}.` : COLLECT_LIST_COPY.badge.collectBySentence(collectBy.day),
  };
}

/** What a row needs to be picked for a visit: where its lot waits. */
type PickableCard = {
  lotId: string;
  /** `placeId` is the venue id, `null` only from an API that predates it. */
  collectBy: { placeId: string | null; placeName: string } | null;
};

/** The lots a person has picked to collect together, and whether one visit can hold them. */
export type CollectSelection =
  | { kind: "none" }
  | { kind: "ready"; lotIds: string[]; place: string; href: string }
  /** `places` are the distinct names of the places; two places can share a name. */
  | { kind: "mixed_places"; places: string[] }
  | { kind: "too_many"; count: number };

/**
 * Hands the picked rows to the booking page as one visit. Only lots awaiting collection can be
 * picked, and a visit is at one place; the server checks both again, so this only says so early.
 * Places are told apart by venue id, as the server does, since venue names are not unique; the
 * name is only for display.
 */
export function collectSelection(
  cards: readonly PickableCard[],
  picked: ReadonlySet<string>,
): CollectSelection {
  const chosen = cards.filter((card) => picked.has(card.lotId) && card.collectBy);
  if (chosen.length === 0) return { kind: "none" };
  const nameByPlace = new Map<string, string>();
  for (const card of chosen) {
    const at = card.collectBy;
    if (at) nameByPlace.set(at.placeId ?? `name:${at.placeName}`, at.placeName);
  }
  if (nameByPlace.size > 1) {
    return { kind: "mixed_places", places: [...new Set(nameByPlace.values())] };
  }
  if (chosen.length > MAX_LOTS_PER_COLLECTION) return { kind: "too_many", count: chosen.length };
  const lotIds = chosen.map((card) => card.lotId);
  return {
    kind: "ready",
    lotIds,
    place: [...nameByPlace.values()][0] ?? "",
    href: collectHref(lotIds),
  };
}

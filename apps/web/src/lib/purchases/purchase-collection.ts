import { COLLECT_COPY } from "@/lib/collect/collect-copy";
import { collectHref } from "@/lib/collect/collect-links";
import { formatCollectionDay } from "@auction/domain";
import type { PurchaseCollectByState } from "@auction/domain";

/** A row's collection badge: what the shared status badge draws. */
export type CollectionBadgeVm = {
  state: "booked" | PurchaseCollectByState;
  label: string;
  tone: "info" | "neutral" | "warning" | "danger";
  shape: "dot" | "ring";
  /** The full sentence for assistive technology and the hover title. */
  title: string;
};

const MAX_VISIT_LOTS = 20;

/**
 * The badge a purchase row wears for collection: `Booked <day>` while a live visit holds it,
 * otherwise `Collect by <day>` or `Overdue` from the collect-by notice the API worked out. A booked
 * lot has no notice (it is no longer awaiting collection), so the two never meet.
 */
export function collectionBadge(input: {
  collectBy: { day: string; title: string; state: PurchaseCollectByState } | null;
  /** The start (ISO) of the live visit the lot is booked into. */
  bookedStart: string | null;
  now: Date;
}): CollectionBadgeVm | null {
  if (input.bookedStart) {
    const start = new Date(input.bookedStart);
    if (!Number.isNaN(start.getTime())) {
      const day = formatCollectionDay(start, input.now);
      const label = COLLECT_COPY.badge.booked(day);
      return { state: "booked", label, tone: "info", shape: "dot", title: label };
    }
  }
  const { collectBy } = input;
  if (!collectBy) return null;
  if (collectBy.state === "overdue") {
    return {
      state: "overdue",
      label: COLLECT_COPY.badge.overdue,
      tone: "danger",
      shape: "dot",
      title: collectBy.title,
    };
  }
  return {
    state: collectBy.state,
    label: COLLECT_COPY.collectBy.short(collectBy.day),
    tone: collectBy.state === "soon" ? "warning" : "neutral",
    shape: "ring",
    title: collectBy.title,
  };
}

/** What a row needs to be picked for a visit. */
type PickableCard = { lotId: string; collectBy: { placeName: string } | null };

/** The lots a person has picked to collect together, and whether one visit can hold them. */
export type CollectSelection =
  | { kind: "none" }
  | { kind: "ready"; lotIds: string[]; place: string; href: string }
  | { kind: "mixed_places"; places: string[] }
  | { kind: "too_many"; count: number };

/**
 * Hands the picked rows to the booking page as one visit. Only lots awaiting collection can be
 * picked, and a visit is at one place; the server checks both again, so this only says so early.
 */
export function collectSelection(
  cards: readonly PickableCard[],
  picked: ReadonlySet<string>,
): CollectSelection {
  const chosen = cards.filter((card) => picked.has(card.lotId) && card.collectBy);
  if (chosen.length === 0) return { kind: "none" };
  const places = [...new Set(chosen.map((card) => card.collectBy?.placeName ?? ""))];
  if (places.length > 1) return { kind: "mixed_places", places };
  if (chosen.length > MAX_VISIT_LOTS) return { kind: "too_many", count: chosen.length };
  const lotIds = chosen.map((card) => card.lotId);
  return { kind: "ready", lotIds, place: places[0] ?? "", href: collectHref(lotIds) };
}

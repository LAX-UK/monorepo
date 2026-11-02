import { formatLotMoment } from "@/lib/bid/lot-moment";
import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import type { EntityWonLot } from "@/lib/data/http/payments.schema";
import type { ReturnedWork } from "@/lib/data/http/workspace-selling.schema";
import { formatMoney } from "@/lib/format-currency";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { lotPath } from "@/lib/seo/url";
import { matchesEveryWord, searchParam } from "@/lib/workspace/list-search";
import { purchaseIsOwned } from "@auction/domain";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";

type Badge = { label: string; tone: StatusBadgeTone; shape: StatusBadgeShape };

export const WHERE_IDS = ["with-us", "on-its-way", "delivered", "collected"] as const;
export type WhereId = (typeof WHERE_IDS)[number];

/** Where an owned work is: still with LAX, on its way, or with the organisation. */
const WHERE: Record<WhereId, Badge> = {
  "with-us": { label: "With us", tone: "info", shape: "dot" },
  "on-its-way": { label: "On its way", tone: "info", shape: "dot" },
  delivered: { label: "Delivered", tone: "success", shape: "check" },
  collected: { label: "Collected", tone: "success", shape: "check" },
};

export const WHERE_LABEL: Record<WhereId, string> = {
  "with-us": WHERE["with-us"].label,
  "on-its-way": WHERE["on-its-way"].label,
  delivered: WHERE.delivered.label,
  collected: WHERE.collected.label,
};

function whereIdFrom(stage: AccountPurchaseFacts["delivery"]["stage"] | undefined): WhereId | null {
  if (!stage || stage === "cancelled") return null;
  if (stage === "delivered") return "delivered";
  if (stage === "collected") return "collected";
  if (stage === "in_transit") return "on-its-way";
  return "with-us";
}

/**
 * Whether a work can be consigned, and what the row says when it cannot yet. A work bought
 * through Bid is consigned once it is paid for; before that the row says so instead of offering
 * the step. A member who may not sell is offered nothing.
 */
export function consignAvailability(input: {
  canSell: boolean;
  /** The purchase's invoice and delivery, when it is known. */
  purchase: {
    invoice: AccountPurchaseFacts["invoice"]["status"];
    deliveryStage: AccountPurchaseFacts["delivery"]["stage"];
  } | null;
}): { canConsign: boolean; note: string | null } {
  if (!input.canSell) return { canConsign: false, note: null };
  if (input.purchase && !purchaseIsOwned(input.purchase)) {
    return { canConsign: false, note: "You can consign it once it's paid." };
  }
  return { canConsign: true, note: null };
}

/** A work the organisation owns through Bid: bought, or consigned and returned unsold. */
export type CollectionWork = {
  key: string;
  kind: "bought" | "returned";
  title: string;
  image: string | null;
  meta: string[];
  /** What it was bought for; `null` when the member's role does not see money. */
  price: string | null;
  /**
   * What the organisation paid, hammer and buyer's premium, from its invoice; `null` before the
   * invoice, for returned works, or when the member's role does not see money.
   */
  boughtFor: string | null;
  /** "Lot 44" for a work bought, "C-1987" for one returned. */
  reference: string | null;
  where: Badge | null;
  whereId: WhereId | null;
  /** Starts Sell a work with the work's details filled in. */
  consignHref: string;
  consignLabel: string;
  /** The member may consign it. */
  canConsign: boolean;
  /** Said in the row in place of the step while it cannot be taken yet. */
  consignNote: string | null;
  href: string;
  at: number;
};

/** The wins the organisation owns: paid for, and not cancelled or refunded. */
export function ownedWins(
  wins: readonly EntityWonLot[],
  factsByLot: ReadonlyMap<string, AccountPurchaseFacts>,
): EntityWonLot[] {
  return wins.filter((win) => {
    const purchase = factsByLot.get(win.lotId);
    return (
      purchase !== undefined &&
      purchaseIsOwned({ invoice: purchase.invoice.status, deliveryStage: purchase.delivery.stage })
    );
  });
}

export function boughtWork(
  win: EntityWonLot,
  facts: AccountPurchaseFacts | undefined,
  input: { now: Date; canSell: boolean },
): CollectionWork {
  const at = Date.parse(win.endedAt);
  const whereId = whereIdFrom(facts?.delivery.stage);
  const consign = consignAvailability({
    canSell: input.canSell,
    purchase: facts ? { invoice: facts.invoice.status, deliveryStage: facts.delivery.stage } : null,
  });
  return {
    key: `lot:${win.lotId}`,
    kind: "bought",
    title: win.title,
    image: win.imageUrl,
    meta: [
      Number.isNaN(at)
        ? null
        : `bought ${formatLotMoment(new Date(at), input.now, { time: false })}`,
      win.lotNumber == null ? null : `lot ${win.lotNumber}`,
    ].filter((fact): fact is string => Boolean(fact)),
    price: win.hammerPrice == null ? null : formatMoney(win.hammerPrice, "GBP"),
    boughtFor:
      win.hammerPrice != null && facts?.invoice.totalDue
        ? formatMoney(facts.invoice.totalDue, "GBP")
        : null,
    reference: win.lotNumber == null ? null : `Lot ${win.lotNumber}`,
    where: whereId ? WHERE[whereId] : null,
    whereId,
    consignHref: `${CLIENT_ROUTES.sellingNew}?fromLot=${encodeURIComponent(win.lotId)}`,
    consignLabel: "Consign this work",
    canConsign: consign.canConsign,
    consignNote: consign.note,
    // The purchase page is for members who follow purchases; the rest open the lot.
    href: facts
      ? `${CLIENT_ROUTES.purchases}/${encodeURIComponent(win.lotId)}`
      : lotPath({ id: win.lotId, title: win.title }),
    at: Number.isNaN(at) ? 0 : at,
  };
}

export function returnedWork(work: ReturnedWork, input: { now: Date }): CollectionWork {
  return {
    key: `returned:${work.submissionId}`,
    kind: "returned",
    title: work.title,
    image: null,
    meta: [
      work.returnedAt
        ? `returned unsold ${formatLotMoment(work.returnedAt, input.now, { time: false })}`
        : "returned unsold",
      work.reference,
    ],
    price: null,
    boughtFor: null,
    reference: work.reference,
    where: WHERE["with-us"],
    whereId: "with-us",
    consignHref: `${CLIENT_ROUTES.sellingNew}?fromSubmission=${encodeURIComponent(work.submissionId)}`,
    consignLabel: "Consign again",
    canConsign: work.canConsignAgain,
    consignNote: null,
    href: lotPath({ id: work.lotId, title: work.title }),
    at: work.returnedAt?.getTime() ?? 0,
  };
}

export const WORKS_SORTS = ["newest", "oldest", "title"] as const;
export type WorksSort = (typeof WORKS_SORTS)[number];
export const WORKS_SORT_LABEL: Record<WorksSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  title: "Title A to Z",
};

export type WorksListQuery = { q: string; where: WhereId | null; sort: WorksSort };

export function parseWorksListQuery(
  params: Readonly<Record<string, string | string[] | undefined>>,
): WorksListQuery {
  const sort = searchParam(params.sort);
  return {
    q: searchParam(params.q) ?? "",
    where: (WHERE_IDS as readonly string[]).includes(searchParam(params.where) ?? "")
      ? (searchParam(params.where) as WhereId)
      : null,
    sort: (WORKS_SORTS as readonly string[]).includes(sort ?? "") ? (sort as WorksSort) : "newest",
  };
}

export function worksListSearch(query: WorksListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.where) params.set("where", query.where);
  if (query.sort !== "newest") params.set("sort", query.sort);
  const text = params.toString();
  return text ? `?${text}` : "";
}

const SORTERS: Record<WorksSort, (a: CollectionWork, b: CollectionWork) => number> = {
  newest: (a, b) => b.at - a.at,
  oldest: (a, b) => a.at - b.at,
  title: (a, b) => a.title.localeCompare(b.title),
};

export function worksInView(
  works: readonly CollectionWork[],
  query: WorksListQuery,
): CollectionWork[] {
  return works
    .filter((work) => !query.where || work.whereId === query.where)
    .filter((work) => matchesEveryWord([work.title, ...work.meta], query.q))
    .sort(SORTERS[query.sort]);
}

export function appliedWorksFilters(query: WorksListQuery): { id: "where"; label: string }[] {
  return query.where ? [{ id: "where", label: `Where: ${WHERE_LABEL[query.where]}` }] : [];
}

/** The places the listed works are, in the order a work travels, for the "Where it is" filter. */
export function worksPlaces(works: readonly CollectionWork[]): WhereId[] {
  const present = new Set(works.flatMap((work) => (work.whereId ? [work.whereId] : [])));
  return WHERE_IDS.filter((id) => present.has(id));
}

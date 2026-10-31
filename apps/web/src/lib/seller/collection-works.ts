import { formatLotMoment } from "@/lib/bid/lot-moment";
import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import type { EntityWonLot } from "@/lib/data/http/payments.schema";
import type { ReturnedWork } from "@/lib/data/http/workspace-selling.schema";
import { formatMoney } from "@/lib/format-currency";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { lotPath } from "@/lib/seo/url";
import { matchesEveryWord, searchParam } from "@/lib/workspace/list-search";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";

type Badge = { label: string; tone: StatusBadgeTone; shape: StatusBadgeShape };

/** Where an owned work is: still with LAX, on its way, or with the organisation. */
const WHERE: Record<"with-us" | "on-its-way" | "delivered" | "collected", Badge> = {
  "with-us": { label: "With us", tone: "info", shape: "dot" },
  "on-its-way": { label: "On its way", tone: "info", shape: "dot" },
  delivered: { label: "Delivered", tone: "success", shape: "check" },
  collected: { label: "Collected", tone: "success", shape: "check" },
};

function whereFrom(stage: AccountPurchaseFacts["delivery"]["stage"] | undefined): Badge | null {
  if (!stage || stage === "cancelled") return null;
  if (stage === "delivered") return WHERE.delivered;
  if (stage === "collected") return WHERE.collected;
  if (stage === "in_transit") return WHERE["on-its-way"];
  return WHERE["with-us"];
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
  /** Starts Sell a work with the work's details filled in. */
  consignHref: string;
  consignLabel: string;
  /** The member may consign it. */
  canConsign: boolean;
  href: string;
  at: number;
};

export function boughtWork(
  win: EntityWonLot,
  facts: AccountPurchaseFacts | undefined,
  input: { now: Date; canSell: boolean },
): CollectionWork {
  const at = Date.parse(win.endedAt);
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
    where: whereFrom(facts?.delivery.stage),
    consignHref: `${CLIENT_ROUTES.sellingNew}?fromLot=${encodeURIComponent(win.lotId)}`,
    consignLabel: "Consign this work",
    canConsign: input.canSell,
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
    consignHref: `${CLIENT_ROUTES.sellingNew}?fromSubmission=${encodeURIComponent(work.submissionId)}`,
    consignLabel: "Consign again",
    canConsign: work.canConsignAgain,
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

export type WorksListQuery = { q: string; sort: WorksSort };

export function parseWorksListQuery(
  params: Readonly<Record<string, string | string[] | undefined>>,
): WorksListQuery {
  const sort = searchParam(params.sort);
  return {
    q: searchParam(params.q) ?? "",
    sort: (WORKS_SORTS as readonly string[]).includes(sort ?? "") ? (sort as WorksSort) : "newest",
  };
}

export function worksListSearch(query: WorksListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
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
    .filter((work) => matchesEveryWord([work.title, ...work.meta], query.q))
    .sort(SORTERS[query.sort]);
}

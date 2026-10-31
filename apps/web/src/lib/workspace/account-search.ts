import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { formatMoney } from "@/lib/ui/format";
import { lotPath } from "@auction/types";
import { z } from "zod";

/*
 * The account's record search (`GET /legal-entities/search`), as the palette shows it. The API
 * answers only for the acting account, and only with the groups the member's role may search, so
 * this module never filters by role itself: it names each group, turns each hit into a row and
 * says which groups a narrower role does not search.
 */

export const ACCOUNT_SEARCH_GROUPS = [
  "consignments",
  "purchases",
  "bids",
  "works",
  "invoices",
  "members",
] as const;
export type AccountSearchGroup = (typeof ACCOUNT_SEARCH_GROUPS)[number];

/** The shortest text the API searches; one letter matches most of an account. */
export const ACCOUNT_SEARCH_MIN_LENGTH = 2;

const lotHit = z.object({
  lotId: z.string(),
  title: z.string(),
  artistName: z.string().nullable().optional(),
  lotNumber: z.number().nullable().optional(),
  saleTitle: z.string().nullable().optional(),
  lotStatus: z.string().nullable().optional(),
});
/** A won lot: the hammer price and where its invoice stands (older answers may leave them out). */
const purchaseHit = lotHit.extend({
  hammerPrice: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  paymentState: z.string().nullable().optional(),
});
/** A lot bid on: the highest bid or maximum in scope, and how it stands. */
const bidHit = lotHit.extend({
  maximum: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  outcome: z.enum(["leading", "outbid", "won", "lost"]).nullable().optional(),
});
const consignmentHit = z.object({
  submissionId: z.string(),
  /** What the seller quotes on the phone ("C-1042"). */
  reference: z.string().nullable().optional(),
  title: z.string(),
  status: z.string(),
});
const invoiceHit = z.object({
  paymentId: z.string(),
  invoiceNumber: z.string().nullable().optional(),
  title: z.string(),
  amount: z.union([z.string(), z.number()]),
  currency: z.string(),
  status: z.string(),
});
const memberHit = z.object({
  memberId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
});

const groupResult = z.discriminatedUnion("group", [
  z.object({ group: z.literal("consignments"), items: z.array(consignmentHit) }),
  z.object({ group: z.literal("purchases"), items: z.array(purchaseHit) }),
  z.object({ group: z.literal("bids"), items: z.array(bidHit) }),
  z.object({ group: z.literal("works"), items: z.array(lotHit) }),
  z.object({ group: z.literal("invoices"), items: z.array(invoiceHit) }),
  z.object({ group: z.literal("members"), items: z.array(memberHit) }),
]);

export const accountSearchResultSchema = z.object({
  searchable: z.array(z.enum(ACCOUNT_SEARCH_GROUPS)),
  groups: z.array(groupResult),
});

export type AccountSearchResult = z.infer<typeof accountSearchResultSchema>;

/** One row of the palette: what it is, a line of detail and where it opens. */
export type SearchRow = {
  id: string;
  label: string;
  meta?: string;
  href: string;
  kind: AccountSearchGroup | "page";
};

export type SearchRowGroup = { id: string; label: string; rows: SearchRow[] };

const GROUP_LABEL: Record<AccountSearchGroup, string> = {
  consignments: "Consignments",
  purchases: "Purchases",
  bids: "Bids",
  works: "Works",
  invoices: "Invoices",
  members: "People",
};

/** The plural noun for a group in the narrower-scope note: "purchases, invoices and people". */
const GROUP_NOUN: Record<AccountSearchGroup, string> = {
  consignments: "consignments",
  purchases: "purchases",
  bids: "bids",
  works: "works",
  invoices: "invoices",
  members: "people",
};

const sentence = (status: string) => {
  const words = status.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

type LotHit = z.infer<typeof lotHit>;
type PurchaseHit = z.infer<typeof purchaseHit>;
type BidHit = z.infer<typeof bidHit>;

const lotRef = (hit: LotHit) => (hit.lotNumber ? `Lot ${hit.lotNumber}` : null);

/** Where a purchase's invoice stands, in the words of the Purchases list. */
const PAYMENT_WORDS: Record<string, string> = {
  not_invoiced: "invoice to follow",
  due: "payment due",
  overdue: "payment overdue",
  processing: "payment being confirmed",
  paid: "paid",
  refunded: "refunded",
  cancelled: "cancelled",
};

/** How a bid stands, in the words of the Bids list. */
const OUTCOME_WORDS: Record<NonNullable<BidHit["outcome"]>, string> = {
  leading: "winning",
  outbid: "outbid",
  won: "won",
  lost: "not won",
};

const money = (amount: string | null | undefined, currency: string | null | undefined) =>
  amount ? formatMoney(amount, currency ?? undefined) : null;

const line = (parts: readonly (string | null | undefined)[]) =>
  parts.filter((part): part is string => Boolean(part)).join(" · ");

/**
 * The second line of each lot row. A purchase says what it was won for and where its payment
 * stands ("Lot 57 · won for £3,200.00 · payment overdue"); a bid says how it stands and the
 * highest bid in scope ("Lot 29 · outbid · your maximum £6,200.00"); a work names its artist.
 * Every row has a second line: without a number or facts, the sale stands in.
 */
const purchaseMeta = (hit: PurchaseHit) => {
  const hammer = money(hit.hammerPrice, hit.currency);
  return line([
    lotRef(hit),
    hammer ? `won for ${hammer}` : "won",
    hit.paymentState ? (PAYMENT_WORDS[hit.paymentState] ?? null) : hit.saleTitle,
  ]);
};

const bidMeta = (hit: BidHit) => {
  const maximum = money(hit.maximum, hit.currency);
  return line([
    lotRef(hit),
    hit.outcome
      ? OUTCOME_WORDS[hit.outcome]
      : hit.lotStatus
        ? sentence(hit.lotStatus).toLowerCase()
        : null,
    maximum ? `your maximum ${maximum}` : hit.saleTitle,
  ]);
};

const workMeta = (hit: LotHit) => line([lotRef(hit), hit.artistName, hit.saleTitle]);

const lotRow = (group: "purchases" | "bids" | "works", hit: LotHit, meta: string): SearchRow => ({
  id: `${group}-${hit.lotId}`,
  label: hit.title,
  meta,
  // A purchase opens its own page; a bid or work opens the lot.
  href:
    group === "purchases"
      ? `${CLIENT_ROUTES.purchases}/${encodeURIComponent(hit.lotId)}`
      : lotPath({ id: hit.lotId, title: hit.title }),
  kind: group,
});

function rowsFor(result: z.infer<typeof groupResult>): SearchRow[] {
  switch (result.group) {
    case "consignments":
      return result.items.map((hit) => ({
        id: `consignment-${hit.submissionId}`,
        label: hit.title,
        meta: `${hit.reference ?? "Consignment"} · ${sentence(hit.status).toLowerCase()}`,
        href: `${CLIENT_ROUTES.consignments}/${hit.submissionId}`,
        kind: "consignments",
      }));
    case "purchases":
      return result.items.map((hit) => lotRow("purchases", hit, purchaseMeta(hit)));
    case "bids":
      return result.items.map((hit) => lotRow("bids", hit, bidMeta(hit)));
    case "works":
      return result.items.map((hit) => lotRow("works", hit, workMeta(hit)));
    case "invoices":
      return result.items.map((hit) => ({
        id: `invoice-${hit.paymentId}`,
        label: hit.invoiceNumber ? `${hit.invoiceNumber} · ${hit.title}` : hit.title,
        meta: `${formatMoney(hit.amount, hit.currency)} · ${sentence(hit.status).toLowerCase()}`,
        href: CLIENT_ROUTES.purchases,
        kind: "invoices",
      }));
    case "members":
      return result.items.map((hit) => ({
        id: `member-${hit.memberId}`,
        label: hit.name,
        meta: `${sentence(hit.role)} · ${hit.email}`,
        href: CLIENT_ROUTES.team,
        kind: "members",
      }));
  }
}

/** The lot a row opens, for rows that open a lot. */
const lotIdOf = (row: SearchRow) =>
  row.kind === "purchases" || row.kind === "bids" || row.kind === "works"
    ? row.id.slice(row.kind.length + 1)
    : null;

/**
 * The result as palette groups, in the API's order, leaving out empty groups. A lot the account
 * both bid on and won is listed once, in the first group that has it (Purchases before Bids), so
 * two identical rows never sit one above the other.
 */
export function searchRowGroups(result: AccountSearchResult): SearchRowGroup[] {
  const seenLots = new Set<string>();
  return result.groups
    .map((group) => ({
      id: group.group,
      label: GROUP_LABEL[group.group],
      rows: rowsFor(group).filter((row) => {
        const lotId = lotIdOf(row);
        if (!lotId) return true;
        if (seenLots.has(lotId)) return false;
        seenLots.add(lotId);
        return true;
      }),
    }))
    .filter((group) => group.rows.length > 0);
}

function listOf(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/**
 * What a narrower role's search leaves out, or `null` when the member searches everything:
 * "Showing what a consignor can open. Purchases, invoices and people aren't searched."
 */
export function narrowerScopeNote(
  searchable: readonly AccountSearchGroup[],
  roleLabel: string,
): string | null {
  // A won work is found under Purchases by the members who follow every purchase, so Works is
  // left out for them by design, not because their role cannot open it.
  const covered = (group: AccountSearchGroup) =>
    searchable.includes(group) || (group === "works" && searchable.includes("purchases"));
  const missing = ACCOUNT_SEARCH_GROUPS.filter((group) => !covered(group)).map(
    (group) => GROUP_NOUN[group],
  );
  if (missing.length === 0) return null;
  const list = listOf(missing);
  const article = /^[aeiou]/i.test(roleLabel) ? "an" : "a";
  return `Showing what ${article} ${roleLabel.toLowerCase()} can open. ${list.charAt(0).toUpperCase()}${list.slice(1)} aren't searched.`;
}

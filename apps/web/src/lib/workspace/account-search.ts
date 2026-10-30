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
const consignmentHit = z.object({
  submissionId: z.string(),
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
  z.object({ group: z.literal("purchases"), items: z.array(lotHit) }),
  z.object({ group: z.literal("bids"), items: z.array(lotHit) }),
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

const lotMeta = (hit: z.infer<typeof lotHit>) =>
  [hit.lotNumber ? `Lot ${hit.lotNumber}` : null, hit.artistName, hit.saleTitle]
    .filter(Boolean)
    .join(" · ");

function rowsFor(result: z.infer<typeof groupResult>): SearchRow[] {
  switch (result.group) {
    case "consignments":
      return result.items.map((hit) => ({
        id: `consignment-${hit.submissionId}`,
        label: hit.title,
        meta: sentence(hit.status),
        href: `${CLIENT_ROUTES.consignments}/${hit.submissionId}`,
        kind: "consignments",
      }));
    case "purchases":
    case "bids":
    case "works":
      return result.items.map((hit) => ({
        id: `${result.group}-${hit.lotId}`,
        label: hit.title,
        meta: lotMeta(hit),
        href: lotPath({ id: hit.lotId, title: hit.title }),
        kind: result.group,
      }));
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

/** The result as palette groups, in the API's order, leaving out empty groups. */
export function searchRowGroups(result: AccountSearchResult): SearchRowGroup[] {
  return result.groups
    .map((group) => ({ id: group.group, label: GROUP_LABEL[group.group], rows: rowsFor(group) }))
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

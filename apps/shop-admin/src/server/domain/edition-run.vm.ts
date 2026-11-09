import type {
  AdminArtworkRunSummary,
  AdminEditionFactsBulkResponse,
  AdminEditionRunDetail,
  AdminEditionRunSpec,
  AdminProofType,
  AdminRunPrint,
} from "@auction/shop-contracts";
import {
  type EditionRunSpec,
  OPEN_EDITION_LOW_STOCK_AT,
  type SetApartPrint,
  allocationNumbering,
  describeEditionRun,
  isOpenStockLow,
  runAllocation,
  setApartPrintFor,
} from "@auction/shop-domain";
import type { StaffStatusTone, StatItem } from "@auction/staff-ui";

/*
 * How a run reads for staff in LAX Admin: its short list label, its one-line summary, the open
 * edition stock counts and the notices for its locked states. Pure, so tested without rendering.
 */

const PROOF_SHORT: Record<AdminProofType, string> = { ap: "AP", pp: "PP", hc: "HC" };
const PROOF_PLURAL: Record<AdminProofType, string> = {
  ap: "Artist's proofs",
  pp: "Printer's proofs",
  hc: "Hors commerce proofs",
};

type MainSpec = Exclude<AdminEditionRunSpec, { type: "proof" | "companion" | "set_apart" }>;

function mainLabel(spec: MainSpec): string {
  switch (spec.type) {
    case "lax_standard":
      return "LAX standard 24";
    case "custom_limited":
      return `Custom ${spec.size}`;
    case "open":
      return "Open";
  }
}

/** For the list's run column: "LAX standard 24", "Custom 40", "Open", "AP 3", "Companion · Open". */
export function runListLabel(spec: AdminEditionRunSpec): string {
  if (spec.type === "proof") return `${PROOF_SHORT[spec.proofType]} ${spec.size}`;
  if (spec.type === "companion") return `Companion · ${mainLabel(spec.run)}`;
  if (spec.type === "set_apart") return "Set apart";
  return mainLabel(spec);
}

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

function mainSummary(spec: MainSpec): string {
  if (spec.type === "open") {
    const { artistPct, laxPct } = spec.defaultSplit;
    return `Open edition · default split ${artistPct} % artist, ${laxPct} % LAX`;
  }
  const allocation = runAllocation(spec);
  const size = spec.type === "lax_standard" ? 24 : spec.size;
  const name =
    spec.type === "lax_standard"
      ? `LAX standard: limited edition of ${size}`
      : `Custom limited edition of ${size}`;
  if (!allocation) return name;
  return [
    name,
    count(allocation.buyer, "buyer", "buyers"),
    `${allocation.artist} artist`,
    `${allocation.lax} LAX`,
  ].join(" · ");
}

/** "Custom limited edition of 40 · 0 buyers · 30 artist · 10 LAX", for the editor. */
export function runSummaryText(spec: AdminEditionRunSpec): string {
  if (spec.type === "proof") {
    const owner = spec.owner === "artist" ? "the artist" : "LAX";
    return `${PROOF_PLURAL[spec.proofType]}, ${spec.size} · owned by ${owner}`;
  }
  if (spec.type === "companion") return `Companion listing · ${mainSummary(spec.run)}`;
  if (spec.type === "set_apart") {
    return `One print sold on its own · owned by ${spec.owner === "artist" ? "the artist" : "LAX"}`;
  }
  return mainSummary(spec);
}

/** "Main run: Harbour at dusk, limited edition of 24". */
export function mainRunLine(main: { title: string; spec: AdminEditionRunSpec }): string {
  const spec = main.spec.type === "companion" ? main.spec.run : main.spec;
  const kind =
    spec.type === "open"
      ? "open edition"
      : spec.type === "proof"
        ? "proof listing"
        : spec.type === "set_apart"
          ? "print sold on its own"
          : `limited edition of ${spec.type === "lax_standard" ? 24 : spec.size}`;
  return `${main.title}, ${kind}`;
}

/** "Created 24 prints as a draft", for the toast after prints are made from an original. */
export function printsCreatedLine(count: number): string {
  if (count === 0) return "Created the listing as a draft";
  return `Created ${count === 1 ? "1 print" : `${count} prints`} as a draft`;
}

/** "Created “Harbour” and 24 prints as drafts", after an original is saved with its prints. */
export function originalAndPrintsCreatedLine(title: string, count: number): string {
  const prints = count === 0 ? "its listing" : count === 1 ? "1 print" : `${count} prints`;
  return `Created “${title}” and ${prints} as drafts`;
}

/** How a linked listing differs from its main run, for the main run's list of listings. */
export function linkedListingLabel(spec: AdminEditionRunSpec): string {
  if (spec.type === "proof") {
    return `${PROOF_PLURAL[spec.proofType]}, ${spec.size}`;
  }
  if (spec.type === "companion") {
    return spec.run.type === "open"
      ? "Companion, open edition"
      : `Companion, limited edition of ${spec.run.type === "lax_standard" ? 24 : spec.run.size}`;
  }
  if (spec.type === "set_apart") return "One print sold on its own";
  return runSummaryText(spec);
}

export function isOpenSpec(spec: AdminEditionRunSpec): boolean {
  return spec.type === "open" || (spec.type === "companion" && spec.run.type === "open");
}

/** Proof and companion listings are made from a main run only. */
export function canHaveLinkedListings(spec: AdminEditionRunSpec): boolean {
  return spec.type !== "proof" && spec.type !== "companion" && spec.type !== "set_apart";
}

const PRINT_STATUS: Record<AdminRunPrint["status"], { label: string; tone: StaffStatusTone }> = {
  not_on_sale: { label: "Not on sale", tone: "neutral" },
  on_sale: { label: "On sale", tone: "success" },
  in_basket: { label: "In a basket", tone: "info" },
  held: { label: "Held", tone: "warning" },
  sold: { label: "Sold", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  set_apart: { label: "Sold on its own", tone: "accepted" },
};

/** The badge for a print in the Prints table. */
export function printStatus(status: AdminRunPrint["status"]): {
  label: string;
  tone: StaffStatusTone;
} {
  return PRINT_STATUS[status];
}

const PRINT_OWNER: Record<AdminRunPrint["owner"], string> = {
  artist: "Artist",
  lax: "LAX",
  buyer: "Buyer entitlement",
};

export function printOwnerLabel(owner: AdminRunPrint["owner"]): string {
  return PRINT_OWNER[owner];
}

/** The run's own sentence for the dialog: "Limited edition of 30". */
export function runEditionLine(spec: AdminEditionRunSpec): string {
  return describeEditionRun(spec as EditionRunSpec).edition;
}

/** Which print of its run a row is, for the wording shoppers will read; null when it has no number. */
export function printIdentity(
  spec: AdminEditionRunSpec,
  print: AdminRunPrint,
): SetApartPrint | null {
  const number = Number.parseInt(print.label.replace(/\D+/g, ""), 10);
  if (!Number.isInteger(number)) return null;
  return setApartPrintFor(spec as EditionRunSpec, { editionNumber: number, proofNumber: number });
}

type Stock = NonNullable<AdminEditionRunDetail["stock"]>;

/** The stock panel's counts, in the order staff check them. */
export function openStockFacts(stock: Stock): StatItem[] {
  // Four figures fill the grid's row; reserved prints are noted under those on sale.
  return [
    {
      id: "on-sale",
      label: "On sale",
      value: stock.onSale,
      ...(stock.reserved > 0 ? { hint: `${stock.reserved} reserved` } : {}),
    },
    { id: "sold", label: "Sold", value: stock.sold },
    { id: "to-print", label: "To print", value: stock.toPrint },
    { id: "in-storage", label: "In storage", value: stock.inStorage },
  ];
}

/** "2 prints on sale", shown while 3 or fewer are on sale; null otherwise. */
export function lowStockTitle(stock: Pick<Stock, "onSale">): string | null {
  if (!isOpenStockLow(stock)) return null;
  if (stock.onSale === 0) return "No prints on sale";
  return count(stock.onSale, "print on sale", "prints on sale");
}

export const LOW_STOCK_HINT = `Add prints or ask the artist to offer more of theirs. Shown in Overview while ${OPEN_EDITION_LOW_STOCK_AT} or fewer are on sale.`;

export const RUN_LOCKED_NOTICE = "Prints have been offered for sale, so the run is fixed.";
export const FACTS_LOCKED_TITLE = "Sold prints were described this way";

/** The locked facts notice body, with how many paid orders a correction would affect. */
export function factsLockedBody(input: { paidOrderCount: number; canCorrect: boolean }): string {
  // Paid orders, and prints sold outside an order such as a third-party sale.
  const orders = count(input.paidOrderCount, "sale", "sales");
  return input.canCorrect
    ? `To correct a mistake, use Correct edition facts. ${orders} would be affected.`
    : `To correct a mistake, a shop admin can use Correct edition facts. ${orders} would be affected.`;
}

/** "Confirmed by Sara M., 12 Oct" or "Not confirmed", for the facts section's status. */
export function factsStatusLabel(
  confirmed: AdminEditionRunDetail["factsConfirmed"],
  format: (iso: string) => string,
): { label: string; confirmed: boolean } {
  if (!confirmed) return { label: "Not confirmed", confirmed: false };
  return {
    label: confirmed.byName
      ? `Confirmed by ${confirmed.byName}, ${format(confirmed.at)}`
      : `Confirmed ${format(confirmed.at)}`,
    confirmed: true,
  };
}

/** Proofs of each type the main run kept that no proof listing sells yet. */
export function proofsAvailable(
  run: Pick<AdminEditionRunDetail, "proofsKept" | "linkedListings">,
): Record<AdminProofType, number> {
  const listed: Record<AdminProofType, number> = { ap: 0, pp: 0, hc: 0 };
  for (const listing of run.linkedListings) {
    if (listing.spec.type === "proof") listed[listing.spec.proofType] += listing.spec.size;
  }
  return {
    ap: Math.max(0, run.proofsKept.ap - listed.ap),
    pp: Math.max(0, run.proofsKept.pp - listed.pp),
    hc: Math.max(0, run.proofsKept.hc - listed.hc),
  };
}

/**
 * What a bulk "Set edition facts" did, in one sentence and a detail per run left out: those with
 * sold prints keep their facts, and those the facts do not fit are refused.
 */
export function bulkFactsSummary(
  response: AdminEditionFactsBulkResponse,
  titleOf: (artworkId: string) => string,
): { tone: "success" | "warning"; message: string; details: string[] } {
  const changed = response.results.filter((result) => result.outcome === "changed").length;
  const left = response.results.filter((result) => result.outcome !== "changed");
  const runs = (value: number) => (value === 1 ? "1 run" : `${value} runs`);
  if (left.length === 0) {
    return { tone: "success", message: `Edition facts set for ${runs(changed)}`, details: [] };
  }
  return {
    tone: "warning",
    message: `Edition facts set for ${runs(changed)}; ${runs(left.length)} left as they were`,
    details: left.map((result) => {
      const why =
        result.outcome === "not_found" ? "It no longer exists" : (result.message ?? "Refused");
      return `${titleOf(result.artworkId)}: ${why}.`;
    }),
  };
}

/** The list's facts column: "Confirmed", "Needs review", or nothing for an original. */
export function factsListLabel(run: AdminArtworkRunSummary | null): string | null {
  if (!run) return null;
  return run.factsStatus === "confirmed" ? "Confirmed" : "Needs review";
}

const HOLDER_NAMES = {
  original_buyer_entitlement: "the buyer of the original",
  artist: "the artist",
  lax: "LAX",
} as const;

/**
 * Who holds which numbers in a limited run, as one sentence: "Prints 1–10 go to the buyer of the
 * original, 11–20 to the artist and 21–24 to LAX." Groups with no prints are left out; null while
 * there are none.
 */
export function allocationSentence(allocation: {
  buyer: number;
  artist: number;
  lax: number;
}): string | null {
  const ranges = allocationNumbering(allocation);
  if (ranges.length === 0) return null;
  const span = (range: { from: number; to: number }) =>
    range.from === range.to ? `${range.from}` : `${range.from}–${range.to}`;
  const parts = ranges.map((range) => `${span(range)} to ${HOLDER_NAMES[range.allocation]}`);
  const last = parts.pop();
  const joined = parts.length > 0 ? `${parts.join(", ")} and ${last}` : last;
  return `Prints ${joined}.`.replace(" to ", " go to ");
}

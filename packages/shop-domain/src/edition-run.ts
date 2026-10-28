import { ShopDomainError } from "./shop-domain-error.js";

/**
 * A run is the set of prints one artwork sells. Its kind, size and allocation are decided when it
 * is created; the facts staff confirm about it live in edition-facts.ts. Everything here is pure.
 */

export const SHOP_EDITION_COUNT = 24 as const;
export const BUYER_ENTITLEMENT_COUNT = 10 as const;
export const ARTIST_ALLOCATION_COUNT = 10 as const;
export const LAX_ALLOCATION_COUNT = 4 as const;

/** A custom limited run holds this many prints, at least and at most. */
export const CUSTOM_RUN_MIN_SIZE = 2 as const;
export const CUSTOM_RUN_MAX_SIZE = 500 as const;

export type EditionAllocationKind = "original_buyer_entitlement" | "artist" | "lax";

export type RunAllocation = { buyer: number; artist: number; lax: number };

export const PROOF_TYPES = ["ap", "pp", "hc"] as const;
export type ProofType = (typeof PROOF_TYPES)[number];

/** Proofs kept outside the edition, recorded on the main run. BAT is kept but not listed for sale. */
export type ProofsKept = { ap: number; pp: number; hc: number; bat: number };

/** Whole percentages that add up to 100. */
export type OpenSplit = { artistPct: number; laxPct: number };

export type LaxStandardRun = { type: "lax_standard" };
export type CustomLimitedRun = {
  type: "custom_limited";
  size: number;
  allocation: RunAllocation;
  /** Whether the run is linked to an original on lax.art, which buyer prints depend on. */
  linkedToOriginal: boolean;
};
export type OpenRun = { type: "open"; defaultSplit: OpenSplit };
export type ProofRun = {
  type: "proof";
  proofType: ProofType;
  size: number;
  /** Who owns the proofs: the artist by default for AP, LAX for PP. */
  owner: "artist" | "lax";
  mainRunId: string;
  /** How many proofs of this type the main run kept. The listing cannot exceed it. */
  proofsKeptOnMain: number;
};
export type MainRunSpec = LaxStandardRun | CustomLimitedRun | OpenRun;
/** Another main run of the same image with its own facts, linked to the first run. */
export type CompanionRun = { type: "companion"; mainRunId: string; run: MainRunSpec };

export type EditionRunSpec = MainRunSpec | ProofRun | CompanionRun;

export const LAX_STANDARD_RUN: LaxStandardRun = { type: "lax_standard" };

export const LAX_STANDARD_ALLOCATION: RunAllocation = {
  buyer: BUYER_ENTITLEMENT_COUNT,
  artist: ARTIST_ALLOCATION_COUNT,
  lax: LAX_ALLOCATION_COUNT,
};

export type PlannedEdition = {
  /** The number printed on the print; null for open-edition prints and proofs. */
  editionNumber: number | null;
  /** Identifies the print in its run and orders picking; equal to the number on numbered runs. */
  stockRef: number;
  /** Proof listings only. */
  proofNumber: number | null;
  allocation: EditionAllocationKind;
};

export type PrintIdentity = {
  editionNumber: number | null;
  proofNumber: number | null;
  stockRef: number;
};

function mainRunOf(spec: EditionRunSpec): MainRunSpec | null {
  if (spec.type === "proof") return null;
  return spec.type === "companion" ? spec.run : spec;
}

export function isOpenRun(spec: EditionRunSpec): boolean {
  return mainRunOf(spec)?.type === "open";
}

/** The number of prints in a limited run; null for an open run. Proofs are never part of it. */
export function runSize(spec: EditionRunSpec): number | null {
  if (spec.type === "proof") return spec.size;
  const main = mainRunOf(spec);
  if (!main || main.type === "open") return null;
  return main.type === "lax_standard" ? SHOP_EDITION_COUNT : main.size;
}

/** Who holds the prints of a limited run; null for an open run. */
export function runAllocation(spec: EditionRunSpec): RunAllocation | null {
  if (spec.type === "proof") {
    return {
      buyer: 0,
      artist: spec.owner === "artist" ? spec.size : 0,
      lax: spec.owner === "lax" ? spec.size : 0,
    };
  }
  const main = mainRunOf(spec);
  if (!main || main.type === "open") return null;
  return main.type === "lax_standard" ? LAX_STANDARD_ALLOCATION : main.allocation;
}

export function proofsKeptFor(kept: ProofsKept, type: ProofType): number {
  return kept[type];
}

function isWholeNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/** Rules 1 to 5 and 9: whether the spec describes a run the shop can sell. */
export function assertValidRunSpec(spec: EditionRunSpec): void {
  if (spec.type === "lax_standard") return;
  if (spec.type === "companion") {
    assertValidRunSpec(spec.run);
    return;
  }
  if (spec.type === "open") {
    assertValidOpenSplit(spec.defaultSplit);
    return;
  }
  if (spec.type === "proof") {
    if (!Number.isInteger(spec.size) || spec.size < 1) {
      throw new ShopDomainError("List at least one proof");
    }
    if (spec.size > spec.proofsKeptOnMain) {
      throw new ShopDomainError(
        `The main run kept ${spec.proofsKeptOnMain} of these proofs, so ${spec.size} cannot be listed`,
      );
    }
    return;
  }
  assertValidCustomRun(spec);
}

function assertValidCustomRun(spec: CustomLimitedRun): void {
  const { size, allocation } = spec;
  if (!Number.isInteger(size) || size < CUSTOM_RUN_MIN_SIZE || size > CUSTOM_RUN_MAX_SIZE) {
    throw new ShopDomainError(
      `The size must be between ${CUSTOM_RUN_MIN_SIZE} and ${CUSTOM_RUN_MAX_SIZE}`,
    );
  }
  if (![allocation.buyer, allocation.artist, allocation.lax].every(isWholeNumber)) {
    throw new ShopDomainError("Allocation counts must be whole numbers, 0 or more");
  }
  const allocated = allocation.buyer + allocation.artist + allocation.lax;
  if (allocated < size) {
    throw new ShopDomainError(`Allocate every print: ${size - allocated} are not allocated`);
  }
  if (allocated > size) {
    throw new ShopDomainError(`Too many prints are allocated: ${allocated - size} over the size`);
  }
  if (allocation.buyer > 0 && !spec.linkedToOriginal) {
    throw new ShopDomainError(
      "Buyer prints need an original on lax.art. Link the original or set buyers to 0",
    );
  }
  if (allocation.artist + allocation.lax < 1) {
    throw new ShopDomainError("At least one print must belong to the artist or LAX");
  }
}

/** Whole percentages for the artist and LAX that add up to 100. */
export function assertValidOpenSplit(split: OpenSplit): void {
  const whole = Number.isInteger(split.artistPct) && Number.isInteger(split.laxPct);
  const inRange = split.artistPct >= 0 && split.laxPct >= 0;
  if (!whole || !inRange || split.artistPct + split.laxPct !== 100) {
    throw new ShopDomainError("The split must be whole percentages that add up to 100");
  }
}

/**
 * The split staff start from when they pick a custom run: the standard 10 / 10 / 4 scaled to the
 * size and rounded, with the remainder going to LAX.
 */
export function defaultCustomAllocation(size: number): RunAllocation {
  const share = Math.round((size * BUYER_ENTITLEMENT_COUNT) / SHOP_EDITION_COUNT);
  const buyer = Math.min(share, size);
  const artist = Math.min(share, size - buyer);
  return { buyer, artist, lax: size - buyer - artist };
}

export type AllocationRange = { allocation: EditionAllocationKind; from: number; to: number };

/** How numbers fall across owners: buyers first, then the artist, then LAX. Empty groups are left out. */
export function allocationNumbering(allocation: RunAllocation): AllocationRange[] {
  const groups: Array<[EditionAllocationKind, number]> = [
    ["original_buyer_entitlement", allocation.buyer],
    ["artist", allocation.artist],
    ["lax", allocation.lax],
  ];
  const ranges: AllocationRange[] = [];
  let next = 1;
  for (const [kind, count] of groups) {
    if (count > 0) ranges.push({ allocation: kind, from: next, to: next + count - 1 });
    next += count;
  }
  return ranges;
}

function planNumbered(allocation: RunAllocation): PlannedEdition[] {
  const plan: PlannedEdition[] = [];
  for (const range of allocationNumbering(allocation)) {
    for (let number = range.from; number <= range.to; number++) {
      plan.push({
        editionNumber: number,
        stockRef: number,
        proofNumber: null,
        allocation: range.allocation,
      });
    }
  }
  return plan;
}

/**
 * The prints a run starts with. Limited runs are numbered 1 to size: buyers first, then the
 * artist, then LAX. A proof listing is numbered 1 to size as proofs. An open run starts with no
 * prints; stock is added in batches (see planOpenEditionBatch).
 */
export function planEditionRun(spec: EditionRunSpec): PlannedEdition[] {
  assertValidRunSpec(spec);
  if (spec.type === "proof") {
    return Array.from({ length: spec.size }, (_, index) => ({
      editionNumber: null,
      stockRef: index + 1,
      proofNumber: index + 1,
      allocation: spec.owner,
    }));
  }
  const allocation = runAllocation(spec);
  return allocation ? planNumbered(allocation) : [];
}

/** Splits a batch of unnumbered prints between the artist and LAX by the run's default split. */
export function proposeBatchSplit(
  quantity: number,
  split: OpenSplit,
): { artist: number; lax: number } {
  assertValidOpenSplit(split);
  const artist = Math.round((quantity * split.artistPct) / 100);
  return { artist, lax: quantity - artist };
}

/** The prints one batch adds to an open run: unnumbered, in stock order from `firstStockRef`. */
export function planOpenEditionBatch(input: {
  firstStockRef: number;
  artistCount: number;
  laxCount: number;
}): PlannedEdition[] {
  const { firstStockRef, artistCount, laxCount } = input;
  if (!Number.isInteger(firstStockRef) || firstStockRef < 1) {
    throw new ShopDomainError("The first stock reference must be 1 or more");
  }
  if (!isWholeNumber(artistCount) || !isWholeNumber(laxCount) || artistCount + laxCount < 1) {
    throw new ShopDomainError("Add at least one print, with whole numbers for each owner");
  }
  const owners: EditionAllocationKind[] = [
    ...Array<EditionAllocationKind>(artistCount).fill("artist"),
    ...Array<EditionAllocationKind>(laxCount).fill("lax"),
  ];
  return owners.map((allocation, index) => ({
    editionNumber: null,
    stockRef: firstStockRef + index,
    proofNumber: null,
    allocation,
  }));
}

function emptyCounts(): Record<EditionAllocationKind, number> {
  return { original_buyer_entitlement: 0, artist: 0, lax: 0 };
}

/**
 * Checks a plan against the run it was made for. Without a spec the plan must be the LAX
 * standard run, or empty (an artwork with no prints).
 */
export function assertValidEditionPlan(plan: PlannedEdition[], spec?: EditionRunSpec): void {
  if (!spec && plan.length === 0) return;
  const run = spec ?? LAX_STANDARD_RUN;
  assertValidRunSpec(run);
  if (run.type === "open") {
    if (plan.length > 0) throw new ShopDomainError("An open edition starts with no prints");
    return;
  }
  const size = runSize(run) ?? 0;
  if (plan.length !== size) {
    throw new ShopDomainError(`Expected ${size} editions, got ${plan.length}`);
  }
  assertPlanNumbering(plan, run, size);
  const expected = runAllocation(run) ?? { buyer: 0, artist: 0, lax: 0 };
  const counts = emptyCounts();
  for (const row of plan) counts[row.allocation] += 1;
  if (counts.original_buyer_entitlement !== expected.buyer) {
    throw new ShopDomainError("Invalid buyer entitlement allocation count");
  }
  if (counts.artist !== expected.artist) {
    throw new ShopDomainError("Invalid artist allocation count");
  }
  if (counts.lax !== expected.lax) {
    throw new ShopDomainError("Invalid LAX allocation count");
  }
}

function assertPlanNumbering(plan: PlannedEdition[], run: EditionRunSpec, size: number): void {
  const isProof = run.type === "proof";
  const printed = plan.map((row) => (isProof ? row.proofNumber : row.editionNumber));
  const unused = plan.map((row) => (isProof ? row.editionNumber : row.proofNumber));
  if (unused.some((value) => value !== null)) {
    throw new ShopDomainError(
      isProof
        ? "Proofs carry a proof number, not an edition number"
        : "Only proofs carry a proof number",
    );
  }
  const sorted = [...printed].sort((a, b) => (a ?? 0) - (b ?? 0));
  if (sorted.some((value, index) => value !== index + 1)) {
    throw new ShopDomainError(`Edition numbers must be exactly 1–${size}`);
  }
  if (plan.some((row) => row.stockRef !== (isProof ? row.proofNumber : row.editionNumber))) {
    throw new ShopDomainError("Stock references must match the print numbers");
  }
}

const PROOF_LABELS: Record<ProofType, string> = { ap: "AP", pp: "PP", hc: "HC" };

export function proofLabel(type: ProofType): string {
  return PROOF_LABELS[type];
}

/** The label on the print and its stock label: "7/24", "AP 2/3" or "OE-0021". Never stored. */
export function printLabel(print: PrintIdentity, run: EditionRunSpec): string {
  if (run.type === "proof") {
    return `${proofLabel(run.proofType)} ${print.proofNumber ?? print.stockRef}/${run.size}`;
  }
  const size = runSize(run);
  if (size === null) return `OE-${String(print.stockRef).padStart(4, "0")}`;
  return `${print.editionNumber ?? print.stockRef}/${size}`;
}

/** Rule 10: a proof or companion links to a main run by the same artist and of the same image. */
export function assertLinkableToMainRun(
  listing: { artistId: string; imageKey: string | null },
  main: { role: "main" | "proof" | "companion"; artistId: string; imageKey: string | null },
): void {
  if (main.role === "proof") {
    throw new ShopDomainError("A listing cannot be linked to a proof");
  }
  if (main.artistId !== listing.artistId) {
    throw new ShopDomainError("A linked listing must be by the same artist as its main run");
  }
  if (main.imageKey === null || main.imageKey !== listing.imageKey) {
    throw new ShopDomainError("A linked listing must be of the same image as its main run");
  }
}

export type RunUsage = {
  /** Prints offered for sale, or already sold, in this run. */
  printsAuthorised: number;
  paidOrders: number;
};

export type RunLocks = { sizeAndAllocationLocked: boolean; factsLocked: boolean };

/** Rule 13: size and allocation lock when the first print is authorised; facts at the first paid order. */
export function runLocks(usage: RunUsage): RunLocks {
  return {
    sizeAndAllocationLocked: usage.printsAuthorised > 0 || usage.paidOrders > 0,
    factsLocked: usage.paidOrders > 0,
  };
}

export function assertRunSizeEditable(usage: RunUsage): void {
  if (runLocks(usage).sizeAndAllocationLocked) {
    throw new ShopDomainError("Prints have been offered for sale, so the run is fixed");
  }
}

export function assertFactsEditable(usage: RunUsage): void {
  if (runLocks(usage).factsLocked) {
    throw new ShopDomainError("Sold prints were described this way, so the facts are fixed");
  }
}

/** Rule 14: an owner may put on sale at most the prints they hold in the run. */
export function saleAuthorityCap(ownedCount: number): number {
  return Math.max(0, ownedCount);
}

export function assertAuthorityWithinOwnership(requested: number, ownedCount: number): void {
  if (!isWholeNumber(requested) || requested > saleAuthorityCap(ownedCount)) {
    throw new ShopDomainError(`You can offer at most ${saleAuthorityCap(ownedCount)} prints`);
  }
}

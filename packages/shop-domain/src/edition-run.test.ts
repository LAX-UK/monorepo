import { describe, expect, it } from "vitest";
import { planEditionsForArtwork } from "./edition-allocation.js";
import {
  type CustomLimitedRun,
  type EditionRunSpec,
  LAX_STANDARD_RUN,
  type OpenRun,
  type ProofRun,
  allocationNumbering,
  assertAuthorityWithinOwnership,
  assertFactsEditable,
  assertLinkableToMainRun,
  assertRunSizeEditable,
  assertValidEditionPlan,
  assertValidOpenSplit,
  assertValidRunSpec,
  defaultCustomAllocation,
  planEditionRun,
  planOpenEditionBatch,
  printLabel,
  proposeBatchSplit,
  runAllocation,
  runLocks,
  runSize,
  saleAuthorityCap,
} from "./edition-run.js";

const custom = (overrides: Partial<CustomLimitedRun> = {}): CustomLimitedRun => ({
  type: "custom_limited",
  size: 40,
  allocation: { buyer: 0, artist: 30, lax: 10 },
  linkedToOriginal: false,
  ...overrides,
});

const open: OpenRun = { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } };

const proof = (overrides: Partial<ProofRun> = {}): ProofRun => ({
  type: "proof",
  proofType: "ap",
  size: 3,
  owner: "artist",
  mainRunId: "main-1",
  proofsKeptOnMain: 3,
  ...overrides,
});

describe("assertValidRunSpec", () => {
  const rejected: Array<[string, EditionRunSpec, string]> = [
    [
      "size below the minimum",
      custom({ size: 1, allocation: { buyer: 0, artist: 1, lax: 0 } }),
      "between 2 and 500",
    ],
    [
      "size above the maximum",
      custom({ size: 501, allocation: { buyer: 0, artist: 501, lax: 0 } }),
      "between 2 and 500",
    ],
    ["a fractional size", custom({ size: 10.5 }), "between 2 and 500"],
    [
      "a negative count",
      custom({ allocation: { buyer: 0, artist: 45, lax: -5 } }),
      "whole numbers",
    ],
    [
      "a fractional count",
      custom({ allocation: { buyer: 0, artist: 30.5, lax: 9.5 } }),
      "whole numbers",
    ],
    [
      "prints not allocated",
      custom({ allocation: { buyer: 0, artist: 28, lax: 10 } }),
      "2 are not allocated",
    ],
    ["prints over-allocated", custom({ allocation: { buyer: 0, artist: 32, lax: 10 } }), "2 over"],
    [
      "buyer prints without an original",
      custom({ allocation: { buyer: 10, artist: 20, lax: 10 } }),
      "Buyer prints need an original",
    ],
    [
      "no print the artist or LAX can sell",
      custom({ linkedToOriginal: true, allocation: { buyer: 40, artist: 0, lax: 0 } }),
      "artist or LAX",
    ],
    [
      "an open split that is not 100",
      { type: "open", defaultSplit: { artistPct: 60, laxPct: 50 } },
      "add up to 100",
    ],
    [
      "a fractional open split",
      { type: "open", defaultSplit: { artistPct: 33.5, laxPct: 66.5 } },
      "add up to 100",
    ],
    ["a proof listing larger than the proofs kept", proof({ size: 4 }), "kept 3"],
    ["an empty proof listing", proof({ size: 0 }), "at least one"],
  ];
  it.each(rejected)("rejects %s", (_name, spec, message) => {
    expect(() => assertValidRunSpec(spec)).toThrow(message);
  });

  const accepted: Array<[string, EditionRunSpec]> = [
    ["LAX standard", LAX_STANDARD_RUN],
    ["the smallest custom run", custom({ size: 2, allocation: { buyer: 0, artist: 1, lax: 1 } })],
    [
      "the largest custom run",
      custom({ size: 500, allocation: { buyer: 0, artist: 250, lax: 250 } }),
    ],
    [
      "buyer prints with an original",
      custom({ linkedToOriginal: true, allocation: { buyer: 10, artist: 20, lax: 10 } }),
    ],
    ["an all-artist run", custom({ allocation: { buyer: 0, artist: 40, lax: 0 } })],
    ["an open run", open],
    ["an open run owned by LAX", { type: "open", defaultSplit: { artistPct: 0, laxPct: 100 } }],
    ["a proof listing of all proofs kept", proof()],
    ["a companion open run", { type: "companion", mainRunId: "main-1", run: open }],
  ];
  it.each(accepted)("accepts %s", (_name, spec) => {
    expect(() => assertValidRunSpec(spec)).not.toThrow();
  });

  it("validates the run inside a companion", () => {
    expect(() =>
      assertValidRunSpec({ type: "companion", mainRunId: "m", run: custom({ size: 1 }) }),
    ).toThrow("between 2 and 500");
  });
});

describe("planEditionRun", () => {
  it("plans the LAX standard run as 1-24: 10 buyer, 10 artist, 4 LAX", () => {
    const plan = planEditionRun(LAX_STANDARD_RUN);
    expect(plan).toHaveLength(24);
    expect(plan.map((row) => row.editionNumber)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1),
    );
    expect(plan.map((row) => row.stockRef)).toEqual(plan.map((row) => row.editionNumber));
    expect(plan.slice(0, 10).every((row) => row.allocation === "original_buyer_entitlement")).toBe(
      true,
    );
    expect(plan.slice(10, 20).every((row) => row.allocation === "artist")).toBe(true);
    expect(plan.slice(20).every((row) => row.allocation === "lax")).toBe(true);
    expect(plan.every((row) => row.proofNumber === null)).toBe(true);
  });

  it("keeps the old entry point identical to the standard spec", () => {
    expect(planEditionsForArtwork(true)).toEqual(planEditionRun(LAX_STANDARD_RUN));
    expect(planEditionsForArtwork(false)).toEqual([]);
  });

  it("numbers a custom run buyers first, then the artist, then LAX", () => {
    const plan = planEditionRun(
      custom({ size: 12, linkedToOriginal: true, allocation: { buyer: 2, artist: 6, lax: 4 } }),
    );
    expect(plan.map((row) => row.allocation)).toEqual([
      ...Array(2).fill("original_buyer_entitlement"),
      ...Array(6).fill("artist"),
      ...Array(4).fill("lax"),
    ]);
    expect(plan.map((row) => row.editionNumber)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });

  it("plans a companion like the run it carries", () => {
    expect(planEditionRun({ type: "companion", mainRunId: "m", run: LAX_STANDARD_RUN })).toEqual(
      planEditionRun(LAX_STANDARD_RUN),
    );
    expect(planEditionRun({ type: "companion", mainRunId: "m", run: open })).toEqual([]);
  });

  it("starts an open run with no prints", () => {
    expect(planEditionRun(open)).toEqual([]);
  });

  it("plans proofs with a proof number, no edition number and the listed owner", () => {
    expect(planEditionRun(proof({ size: 2, owner: "lax", proofType: "pp" }))).toEqual([
      { editionNumber: null, stockRef: 1, proofNumber: 1, allocation: "lax" },
      { editionNumber: null, stockRef: 2, proofNumber: 2, allocation: "lax" },
    ]);
  });

  it("refuses to plan an invalid spec", () => {
    expect(() => planEditionRun(custom({ size: 600 }))).toThrow("between 2 and 500");
  });
});

describe("assertValidEditionPlan", () => {
  it("still accepts the standard plan and an empty plan without a spec", () => {
    expect(() => assertValidEditionPlan(planEditionRun(LAX_STANDARD_RUN))).not.toThrow();
    expect(() => assertValidEditionPlan([])).not.toThrow();
  });

  it("checks a plan against its spec", () => {
    const spec = custom({ size: 12, allocation: { buyer: 0, artist: 8, lax: 4 } });
    expect(() => assertValidEditionPlan(planEditionRun(spec), spec)).not.toThrow();
    expect(() => assertValidEditionPlan(planEditionRun(spec), LAX_STANDARD_RUN)).toThrow(
      "Expected 24 editions, got 12",
    );
  });

  it("rejects numbers that skip or repeat", () => {
    const plan = planEditionRun(LAX_STANDARD_RUN);
    const broken = plan.map((row, i) =>
      i === 3 ? { ...row, editionNumber: 5, stockRef: 5 } : row,
    );
    expect(() => assertValidEditionPlan(broken, LAX_STANDARD_RUN)).toThrow("exactly 1–24");
  });

  it("rejects the wrong allocation counts", () => {
    const plan = planEditionRun(LAX_STANDARD_RUN).map((row, i) =>
      i === 0 ? { ...row, allocation: "lax" as const } : row,
    );
    expect(() => assertValidEditionPlan(plan, LAX_STANDARD_RUN)).toThrow("buyer entitlement");
  });

  it("rejects a stock reference that differs from the number", () => {
    const plan = planEditionRun(LAX_STANDARD_RUN).map((row, i) =>
      i === 0 ? { ...row, stockRef: 99 } : row,
    );
    expect(() => assertValidEditionPlan(plan, LAX_STANDARD_RUN)).toThrow("Stock references");
  });

  it("expects an open run to start empty and a proof plan to carry proof numbers", () => {
    expect(() => assertValidEditionPlan(planEditionRun(LAX_STANDARD_RUN), open)).toThrow(
      "no prints",
    );
    expect(() => assertValidEditionPlan(planEditionRun(proof()), proof())).not.toThrow();
    expect(() =>
      assertValidEditionPlan(planEditionRun(LAX_STANDARD_RUN).slice(0, 3), proof()),
    ).toThrow("proof number");
  });
});

describe("open edition batches", () => {
  it.each([
    [20, 50, { artist: 10, lax: 10 }],
    [7, 50, { artist: 4, lax: 3 }],
    [10, 0, { artist: 0, lax: 10 }],
    [10, 100, { artist: 10, lax: 0 }],
    [3, 25, { artist: 1, lax: 2 }],
  ])("proposes %i prints at %i%% artist as %j", (quantity, artistPct, expected) => {
    expect(proposeBatchSplit(quantity, { artistPct, laxPct: 100 - artistPct })).toEqual(expected);
  });

  it("plans unnumbered rows from the next stock reference, artist first", () => {
    const plan = planOpenEditionBatch({ firstStockRef: 21, artistCount: 2, laxCount: 1 });
    expect(plan).toEqual([
      { editionNumber: null, stockRef: 21, proofNumber: null, allocation: "artist" },
      { editionNumber: null, stockRef: 22, proofNumber: null, allocation: "artist" },
      { editionNumber: null, stockRef: 23, proofNumber: null, allocation: "lax" },
    ]);
  });

  it.each([
    [{ firstStockRef: 0, artistCount: 1, laxCount: 0 }, "1 or more"],
    [{ firstStockRef: 1, artistCount: 0, laxCount: 0 }, "at least one"],
    [{ firstStockRef: 1, artistCount: -1, laxCount: 3 }, "whole numbers"],
    [{ firstStockRef: 1, artistCount: 1.5, laxCount: 1 }, "whole numbers"],
  ])("rejects the batch %j", (input, message) => {
    expect(() => planOpenEditionBatch(input)).toThrow(message);
  });

  it("validates the default split", () => {
    expect(() => assertValidOpenSplit({ artistPct: 70, laxPct: 30 })).not.toThrow();
    expect(() => assertValidOpenSplit({ artistPct: -10, laxPct: 110 })).toThrow("add up to 100");
  });
});

describe("defaultCustomAllocation", () => {
  it.each([
    [24, { buyer: 10, artist: 10, lax: 4 }],
    [40, { buyer: 17, artist: 17, lax: 6 }],
    [12, { buyer: 5, artist: 5, lax: 2 }],
    [2, { buyer: 1, artist: 1, lax: 0 }],
    [3, { buyer: 1, artist: 1, lax: 1 }],
    [500, { buyer: 208, artist: 208, lax: 84 }],
  ])("scales the standard split to %i prints", (size, expected) => {
    const result = defaultCustomAllocation(size);
    expect(result).toEqual(expected);
    expect(result.buyer + result.artist + result.lax).toBe(size);
  });
});

describe("allocationNumbering", () => {
  it("lists the number range of each owner and leaves out empty groups", () => {
    expect(allocationNumbering({ buyer: 10, artist: 10, lax: 4 })).toEqual([
      { allocation: "original_buyer_entitlement", from: 1, to: 10 },
      { allocation: "artist", from: 11, to: 20 },
      { allocation: "lax", from: 21, to: 24 },
    ]);
    expect(allocationNumbering({ buyer: 0, artist: 30, lax: 10 })).toEqual([
      { allocation: "artist", from: 1, to: 30 },
      { allocation: "lax", from: 31, to: 40 },
    ]);
  });
});

describe("runSize and runAllocation", () => {
  it("reads size and allocation from every kind of run", () => {
    expect(runSize(LAX_STANDARD_RUN)).toBe(24);
    expect(runSize(custom())).toBe(40);
    expect(runSize(open)).toBeNull();
    expect(runSize(proof())).toBe(3);
    expect(runSize({ type: "companion", mainRunId: "m", run: custom() })).toBe(40);
    expect(runAllocation(LAX_STANDARD_RUN)).toEqual({ buyer: 10, artist: 10, lax: 4 });
    expect(runAllocation(open)).toBeNull();
    expect(runAllocation(proof({ owner: "lax" }))).toEqual({ buyer: 0, artist: 0, lax: 3 });
  });
});

describe("printLabel", () => {
  const print = { editionNumber: null, proofNumber: null, stockRef: 1 };
  it.each([
    ["a numbered print", { ...print, editionNumber: 7, stockRef: 7 }, LAX_STANDARD_RUN, "7/24"],
    ["a print in a custom run", { ...print, editionNumber: 31, stockRef: 31 }, custom(), "31/40"],
    ["a proof", { ...print, proofNumber: 2, stockRef: 2 }, proof(), "AP 2/3"],
    ["a printer's proof", { ...print, proofNumber: 1 }, proof({ proofType: "pp" }), "PP 1/3"],
    ["an open print", { ...print, stockRef: 21 }, open, "OE-0021"],
    ["a large open stock reference", { ...print, stockRef: 12345 }, open, "OE-12345"],
    [
      "a print in a companion run",
      { ...print, editionNumber: 3, stockRef: 3 },
      { type: "companion", mainRunId: "m", run: LAX_STANDARD_RUN } as EditionRunSpec,
      "3/24",
    ],
  ])("labels %s", (_name, identity, run, expected) => {
    expect(printLabel(identity, run)).toBe(expected);
  });
});

describe("linked listings", () => {
  const main = { role: "main" as const, artistId: "a1", imageKey: "img-1" };
  it("accepts a main run by the same artist with the same image", () => {
    expect(() =>
      assertLinkableToMainRun({ artistId: "a1", imageKey: "img-1" }, main),
    ).not.toThrow();
  });
  it.each([
    [
      { artistId: "a1", imageKey: "img-1" },
      { ...main, role: "proof" as const },
      "linked to a proof",
    ],
    [{ artistId: "a2", imageKey: "img-1" }, main, "same artist"],
    [{ artistId: "a1", imageKey: "img-2" }, main, "same image"],
    [{ artistId: "a1", imageKey: null }, { ...main, imageKey: null }, "same image"],
  ])("rejects %j linked to %j", (listing, target, message) => {
    expect(() => assertLinkableToMainRun(listing, target)).toThrow(message);
  });
});

describe("locks and sale authority", () => {
  it.each([
    [
      { printsAuthorised: 0, paidOrders: 0 },
      { sizeAndAllocationLocked: false, factsLocked: false },
    ],
    [
      { printsAuthorised: 4, paidOrders: 0 },
      { sizeAndAllocationLocked: true, factsLocked: false },
    ],
    [
      { printsAuthorised: 4, paidOrders: 1 },
      { sizeAndAllocationLocked: true, factsLocked: true },
    ],
  ])("locks for %j", (usage, expected) => {
    expect(runLocks(usage)).toEqual(expected);
  });

  it("explains each lock", () => {
    expect(() => assertRunSizeEditable({ printsAuthorised: 1, paidOrders: 0 })).toThrow(
      "run is fixed",
    );
    expect(() => assertRunSizeEditable({ printsAuthorised: 0, paidOrders: 0 })).not.toThrow();
    expect(() => assertFactsEditable({ printsAuthorised: 5, paidOrders: 0 })).not.toThrow();
    expect(() => assertFactsEditable({ printsAuthorised: 5, paidOrders: 1 })).toThrow(
      "facts are fixed",
    );
  });

  it("caps sale authority at the prints the owner holds", () => {
    expect(saleAuthorityCap(30)).toBe(30);
    expect(saleAuthorityCap(-1)).toBe(0);
    expect(() => assertAuthorityWithinOwnership(30, 30)).not.toThrow();
    expect(() => assertAuthorityWithinOwnership(0, 4)).not.toThrow();
    expect(() => assertAuthorityWithinOwnership(31, 30)).toThrow("at most 30");
    expect(() => assertAuthorityWithinOwnership(-1, 30)).toThrow("at most 30");
  });
});

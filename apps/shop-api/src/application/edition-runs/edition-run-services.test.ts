import type { AdminEditionFacts } from "@auction/shop-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import { createInMemoryEditionRuns } from "../../test-support/in-memory-edition-runs.js";
import { editionFactsInput } from "./edition-run-input.js";
import { createEditionRunServices } from "./edition-run-services.js";

const NOW = new Date("2026-10-28T09:00:00.000Z");
const ACTOR = "staff-sara";

const HAND_SIGNED: AdminEditionFacts = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: {
    kind: "included",
    issuer: "artist",
    form: "paper",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
  },
};
const UNSIGNED: AdminEditionFacts = {
  numbering: "none",
  signature: { kind: "unsigned" },
  certificate: { kind: "none" },
};

let keys = 0;
const staff = () => ({ actorSubjectId: ACTOR, idempotencyKey: `key-${++keys}` });

function setup() {
  const memory = createInMemoryEditionRuns();
  const services = createEditionRunServices({ uow: memory.uow, clock: { now: () => NOW } });
  return { memory, services };
}

async function newRun(
  context: ReturnType<typeof setup>,
  artworkId: string,
  run: Parameters<ReturnType<typeof setup>["services"]["recorder"]["recordNewRun"]>[1]["run"],
  options: { linkedOriginal?: string } = {},
) {
  context.memory.addArtwork({
    artworkId,
    sourceOriginalArtworkId: options.linkedOriginal ?? null,
  });
  return context.services.recorder.recordNewRun({} as never, {
    artworkId,
    artistId: "artist-1",
    sourceOriginalArtworkId: options.linkedOriginal ?? null,
    run,
    actorSubjectId: ACTOR,
  });
}

describe("CreateEditionRun", () => {
  it("creates the LAX standard run: 24 prints, 10 buyer, 10 artist, 4 LAX", async () => {
    const context = setup();
    expect(await newRun(context, "std", { spec: { type: "lax_standard" } })).toBe(24);
    const prints = context.memory.printsOf("std");
    expect(prints.filter((p) => p.allocation === "original_buyer_entitlement")).toHaveLength(10);
    expect(prints.filter((p) => p.allocation === "artist")).toHaveLength(10);
    expect(prints.filter((p) => p.allocation === "lax").map((p) => p.editionNumber)).toEqual([
      21, 22, 23, 24,
    ]);
    expect(context.memory.audit.at(-1)?.action).toBe("record_edition_run");
  });

  it("creates a custom run numbered buyers, then artist, then LAX", async () => {
    const context = setup();
    const count = await newRun(context, "custom", {
      spec: { type: "custom_limited", size: 40, allocation: { buyer: 0, artist: 30, lax: 10 } },
      proofsKept: { ap: 3, pp: 1, hc: 0, bat: 0 },
    });
    expect(count).toBe(40);
    const prints = context.memory.printsOf("custom");
    expect(prints.find((p) => p.editionNumber === 30)?.allocation).toBe("artist");
    expect(prints.find((p) => p.editionNumber === 31)?.allocation).toBe("lax");
    expect(context.memory.runs.get("custom")?.proofsKept.ap).toBe(3);
  });

  it("refuses buyer prints without a linked original, with the staff wording", async () => {
    const context = setup();
    await expect(
      newRun(context, "no-original", {
        spec: { type: "custom_limited", size: 24, allocation: { buyer: 6, artist: 14, lax: 4 } },
      }),
    ).rejects.toThrow(
      "Buyer prints need an original on lax.art. Link the original or set buyers to 0",
    );
    expect(
      await newRun(
        context,
        "with-original",
        {
          spec: { type: "custom_limited", size: 24, allocation: { buyer: 6, artist: 14, lax: 4 } },
        },
        { linkedOriginal: "original-1" },
      ),
    ).toBe(24);
  });

  it.each([
    [{ size: 501, allocation: { buyer: 0, artist: 501, lax: 0 } }, "between 2 and 500"],
    [{ size: 24, allocation: { buyer: 0, artist: 12, lax: 10 } }, "2 are not allocated"],
    [{ size: 4, allocation: { buyer: 0, artist: 0, lax: 0 } }, "4 are not allocated"],
  ])("refuses a custom run that breaks a rule (%j)", async (custom, message) => {
    const context = setup();
    await expect(
      newRun(context, "bad", { spec: { type: "custom_limited", ...custom } }),
    ).rejects.toThrow(message);
  });

  it("creates an open edition with its first batch, putting LAX's prints on sale", async () => {
    const context = setup();
    const count = await newRun(context, "open", {
      spec: { type: "open", defaultArtistPct: 50 },
      firstBatch: { artistCount: 10, laxCount: 10, custody: "unprinted" },
    });
    expect(count).toBe(20);
    const prints = context.memory.printsOf("open");
    expect(prints.every((p) => p.editionNumber === null)).toBe(true);
    expect(prints.filter((p) => p.listingStatus === "authorised").map((p) => p.stockRef)).toEqual(
      Array.from({ length: 10 }, (_, i) => 11 + i),
    );
  });

  it("records the facts given at creation, confirmed by the person creating the run", async () => {
    const context = setup();
    await newRun(context, "facts", {
      spec: { type: "lax_standard" },
      facts: HAND_SIGNED,
      factsConfirmed: true,
    });
    expect(context.memory.facts.get("facts")?.facts.confirmed).toEqual({ by: ACTOR, at: NOW });
  });

  it("refuses numbered facts on an open edition", async () => {
    const context = setup();
    await expect(
      newRun(context, "open-numbered", {
        spec: { type: "open", defaultArtistPct: 50 },
        facts: HAND_SIGNED,
      }),
    ).rejects.toThrow("An open edition is never numbered");
  });

  describe("replace", () => {
    it("plans the prints again while nothing has been offered, and asks for the facts again", async () => {
      const context = setup();
      await newRun(context, "draft", {
        spec: { type: "lax_standard" },
        facts: UNSIGNED,
        factsConfirmed: true,
      });
      const version = context.memory.artworks.get("draft")?.updatedAt.toISOString() ?? "";
      await context.services.runs.replace({
        ...staff(),
        artworkId: "draft",
        run: { type: "custom_limited", size: 12, allocation: { buyer: 0, artist: 8, lax: 4 } },
        proofsKept: { ap: 0, pp: 0, hc: 0, bat: 0 },
        expectedVersion: version,
      });
      expect(context.memory.printsOf("draft")).toHaveLength(12);
      expect(context.memory.facts.get("draft")?.facts.confirmed).toBeNull();
    });

    it("is fixed once a print has been offered for sale (rule 13)", async () => {
      const context = setup();
      await newRun(context, "offered", { spec: { type: "lax_standard" } });
      context.memory.usage.set("offered", { printsAuthorised: 1, paidOrders: 0 });
      await expect(
        context.services.runs.replace({
          ...staff(),
          artworkId: "offered",
          run: { type: "custom_limited", size: 12, allocation: { buyer: 0, artist: 8, lax: 4 } },
          proofsKept: { ap: 0, pp: 0, hc: 0, bat: 0 },
          expectedVersion: context.memory.artworks.get("offered")?.updatedAt.toISOString() ?? "",
        }),
      ).rejects.toThrow("Prints have been offered for sale, so the run is fixed");
      expect(context.memory.printsOf("offered")).toHaveLength(24);
    });

    it("still records the proofs kept on a fixed run, and refuses a stale version", async () => {
      const context = setup();
      await newRun(context, "kept", { spec: { type: "lax_standard" } });
      context.memory.usage.set("kept", { printsAuthorised: 4, paidOrders: 0 });
      await context.services.runs.replace({
        ...staff(),
        artworkId: "kept",
        run: { type: "lax_standard" },
        proofsKept: { ap: 3, pp: 0, hc: 0, bat: 0 },
        expectedVersion: context.memory.artworks.get("kept")?.updatedAt.toISOString() ?? "",
      });
      expect(context.memory.runs.get("kept")?.proofsKept.ap).toBe(3);
      await expect(
        context.services.runs.replace({
          ...staff(),
          artworkId: "kept",
          run: { type: "lax_standard" },
          proofsKept: { ap: 2, pp: 0, hc: 0, bat: 0 },
          expectedVersion: "2020-01-01T00:00:00.000Z",
        }),
      ).rejects.toBeInstanceOf(StaleVersionError);
    });
  });
});

describe("SaveEditionFacts", () => {
  it("saves and confirms facts, with the version check", async () => {
    const context = setup();
    await newRun(context, "run", { spec: { type: "lax_standard" } });
    const saved = await context.services.facts.save({
      ...staff(),
      artworkId: "run",
      facts: editionFactsInput(HAND_SIGNED),
      confirmed: true,
      expectedFactsVersion: null,
    });
    expect(saved.confirmed).toBe(true);
    await expect(
      context.services.facts.save({
        ...staff(),
        artworkId: "run",
        facts: editionFactsInput(UNSIGNED),
        confirmed: false,
        expectedFactsVersion: null,
      }),
    ).rejects.toBeInstanceOf(StaleVersionError);
    const unconfirmed = await context.services.facts.save({
      ...staff(),
      artworkId: "run",
      facts: editionFactsInput(UNSIGNED),
      confirmed: false,
      expectedFactsVersion: saved.factsVersion,
    });
    expect(unconfirmed.confirmed).toBe(false);
    expect(context.memory.facts.get("run")?.facts.confirmed).toBeNull();
  });

  it("locks the facts at the first paid order (rule 13)", async () => {
    const context = setup();
    await newRun(context, "sold", { spec: { type: "lax_standard" }, facts: UNSIGNED });
    context.memory.usage.set("sold", { printsAuthorised: 10, paidOrders: 1 });
    await expect(
      context.services.facts.save({
        ...staff(),
        artworkId: "sold",
        facts: editionFactsInput(HAND_SIGNED),
        confirmed: true,
        expectedFactsVersion: context.memory.facts.get("sold")?.version ?? null,
      }),
    ).rejects.toThrow("Sold prints were described this way");
  });

  it("lets a shop admin correct sold facts with a reason, keeping the orders' record", async () => {
    const context = setup();
    await newRun(context, "fix", {
      spec: { type: "lax_standard" },
      facts: UNSIGNED,
      factsConfirmed: true,
    });
    context.memory.usage.set("fix", { printsAuthorised: 10, paidOrders: 2 });
    context.memory.paidOrders.set("fix", [
      { orderId: "o1", reference: "LAX-S-1001", paidAt: NOW },
      { orderId: "o2", reference: "LAX-S-1002", paidAt: NOW },
    ]);
    await expect(
      context.services.facts.correct({
        ...staff(),
        artworkId: "fix",
        facts: editionFactsInput(HAND_SIGNED),
        reason: "  ",
        expectedFactsVersion: context.memory.facts.get("fix")?.version ?? null,
      }),
    ).rejects.toThrow("Say why");
    const result = await context.services.facts.correct({
      ...staff(),
      artworkId: "fix",
      facts: editionFactsInput(HAND_SIGNED),
      reason: "Signed in pencil, confirmed with the studio",
      expectedFactsVersion: context.memory.facts.get("fix")?.version ?? null,
    });
    expect(result.affectedOrders).toBe(2);
    expect(context.memory.snapshots.get("o1")).toMatchObject({
      facts: { signature: { kind: "unsigned" } },
    });
    const entry = context.memory.audit.at(-1);
    expect(entry).toMatchObject({
      action: "correct_edition_facts",
      capability: "edition_facts.correct",
      afterJson: { affectedOrders: ["LAX-S-1001", "LAX-S-1002"] },
    });
  });

  it("sets facts on several runs, skipping runs with sales and refusing ones they do not fit", async () => {
    const context = setup();
    await newRun(context, "a", { spec: { type: "lax_standard" } });
    await newRun(context, "b", { spec: { type: "lax_standard" } });
    await newRun(context, "c", { spec: { type: "open", defaultArtistPct: 50 } });
    context.memory.usage.set("b", { printsAuthorised: 4, paidOrders: 1 });
    const { results } = await context.services.facts.setForRuns({
      ...staff(),
      artworkIds: ["c", "a", "b", "missing"],
      facts: editionFactsInput(HAND_SIGNED),
      confirmed: true,
    });
    expect(results.map((r) => [r.artworkId, r.outcome])).toEqual([
      ["c", "refused"],
      ["a", "changed"],
      ["b", "skipped"],
      ["missing", "not_found"],
    ]);
    expect(results[2]?.message).toBe("Sold prints were described this way");
  });
});

describe("AddOpenEditionStock", () => {
  it("adds a batch after the last stock reference", async () => {
    const context = setup();
    await newRun(context, "night", {
      spec: { type: "open", defaultArtistPct: 50 },
      firstBatch: { artistCount: 10, laxCount: 10, custody: "unprinted" },
    });
    const result = await context.services.stock.add({
      ...staff(),
      artworkId: "night",
      batch: {
        artistCount: 5,
        laxCount: 5,
        custodyStatus: "stored",
        storageLocation: "Plan chest C, drawer 1",
      },
    });
    expect(result).toMatchObject({ firstStockRef: 21, quantity: 10, laxPrintsOnSale: 5 });
  });

  it("needs a storage place for printed stock, and refuses a limited run", async () => {
    const context = setup();
    await newRun(context, "night", { spec: { type: "open", defaultArtistPct: 50 } });
    await expect(
      context.services.stock.add({
        ...staff(),
        artworkId: "night",
        batch: { artistCount: 1, laxCount: 1, custodyStatus: "stored", storageLocation: null },
      }),
    ).rejects.toThrow("Say where the printed stock is stored");
    await newRun(context, "limited", { spec: { type: "lax_standard" } });
    await expect(
      context.services.stock.add({
        ...staff(),
        artworkId: "limited",
        batch: { artistCount: 1, laxCount: 1, custodyStatus: "unprinted", storageLocation: null },
      }),
    ).rejects.toThrow("only be added to an open edition");
  });
});

describe("CreateLinkedListing", () => {
  const proofCommand = (overrides: Record<string, unknown> = {}) => ({
    ...staff(),
    mainArtworkId: "harbour",
    proofType: "ap" as const,
    count: 3,
    owner: "artist" as const,
    printPricePence: null,
    horsCommerceApproved: false,
    canSetPrice: true,
    canApproveHorsCommerce: false,
    ...overrides,
  });

  async function harbour(context: ReturnType<typeof setup>) {
    await newRun(context, "harbour", {
      spec: { type: "lax_standard" },
      proofsKept: { ap: 3, pp: 1, hc: 2, bat: 0 },
      facts: HAND_SIGNED,
      factsConfirmed: true,
    });
    const main = context.memory.artworks.get("harbour");
    if (main) main.title = "Harbour at dusk";
  }

  it("lists the proofs kept as AP 1 to 3, with the main run's facts left to confirm", async () => {
    const context = setup();
    await harbour(context);
    const listing = await context.services.listings.createProofListing(proofCommand());
    expect(context.memory.artworks.get(listing.artworkId)?.title).toBe(
      "Harbour at dusk (artist's proof)",
    );
    expect(context.memory.printsOf(listing.artworkId).map((p) => p.proofNumber)).toEqual([1, 2, 3]);
    const facts = context.memory.facts.get(listing.artworkId)?.facts;
    expect(facts?.signature).toEqual(HAND_SIGNED.signature);
    expect(facts?.confirmed).toBeNull();
  });

  it("never lists more proofs than were kept, across listings", async () => {
    const context = setup();
    await harbour(context);
    await context.services.listings.createProofListing(proofCommand({ count: 2 }));
    await expect(
      context.services.listings.createProofListing(proofCommand({ count: 2 })),
    ).rejects.toThrow(ShopDomainError);
  });

  it("lists hors commerce proofs only with a shop admin's approval", async () => {
    const context = setup();
    await harbour(context);
    await expect(
      context.services.listings.createProofListing(
        proofCommand({ proofType: "hc", owner: "lax", count: 1, horsCommerceApproved: true }),
      ),
    ).rejects.toThrow("only with a shop admin's approval");
    const listing = await context.services.listings.createProofListing(
      proofCommand({
        proofType: "hc",
        owner: "lax",
        count: 1,
        horsCommerceApproved: true,
        canApproveHorsCommerce: true,
      }),
    );
    expect(context.memory.audit.at(-1)).toMatchObject({
      action: "create_proof_listing",
      capability: "hors_commerce.approve",
      targetId: listing.artworkId,
    });
  });

  it("needs price access to set a price", async () => {
    const context = setup();
    await harbour(context);
    await expect(
      context.services.listings.createProofListing(
        proofCommand({ printPricePence: 65_000, canSetPrice: false }),
      ),
    ).rejects.toBeInstanceOf(ShopApiError);
  });

  it("creates a companion: another run of the image with its own facts", async () => {
    const context = setup();
    await harbour(context);
    const listing = await context.services.listings.createCompanionListing({
      ...staff(),
      mainArtworkId: "harbour",
      slug: "harbour-at-dusk-unsigned",
      title: "Harbour at dusk, unsigned",
      run: { spec: { type: "open", defaultArtistPct: 50 }, facts: UNSIGNED },
      printPricePence: null,
      canSetPrice: true,
    });
    expect(context.memory.specOf(listing.artworkId)).toEqual({
      type: "companion",
      mainRunId: "harbour",
      run: { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } },
    });
    await expect(
      context.services.listings.createProofListing(
        proofCommand({ mainArtworkId: listing.artworkId }),
      ),
    ).rejects.toThrow("not to another listing");
  });
});

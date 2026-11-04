import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import { assessProduct } from "./assess-product.js";
import { decideArtworkOutcome } from "./decide-outcome.js";
import { product } from "./fixtures/load-fixtures.js";

function entry(overrides: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry {
  return {
    id: "6f1c1d0e-0000-4000-8000-000000000001",
    zohoProductId: "5000000000001000001",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    kind: "original",
    sourceOriginalId: null,
    title: "Harbour at dusk",
    artist: { zohoArtistId: "5000000000000077001", name: "Aidan Phelan", code: "PH" },
    medium: "Oil on canvas",
    dimensions: "60 x 80 cm",
    year: 2024,
    imageRefs: [],
    catalogueStatus: "Available",
    offer: { state: "held", ref: null },
    zohoModifiedAt: new Date("2026-09-01T00:00:00.000Z"),
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 1,
    ...overrides,
  };
}

const none = { existing: null, holderOfStockCode: null };

describe("decideArtworkOutcome", () => {
  it("creates a Product the register does not hold", () => {
    expect(decideArtworkOutcome(assessProduct(product(1)), none).outcome).toBe("create");
  });

  it("skips a Product by a demo artist, new or existing", () => {
    const a = assessProduct(product(3));
    expect(decideArtworkOutcome(a, none)).toMatchObject({
      outcome: "skipped",
      reason: "demo_artist",
    });
    expect(
      decideArtworkOutcome(a, {
        existing: entry({ zohoProductId: a.productId }),
        holderOfStockCode: null,
      }),
    ).toMatchObject({ outcome: "skipped", reason: "demo_artist" });
  });

  it("skips a new Product that has a blocker, naming the first", () => {
    expect(decideArtworkOutcome(assessProduct(product(4)), none)).toMatchObject({
      outcome: "skipped",
      reason: "missing_stock_code",
    });
    expect(decideArtworkOutcome(assessProduct(product(6)), none)).toMatchObject({
      outcome: "skipped",
      reason: "missing_artist",
    });
  });

  it("skips a new Product whose stock code another record already holds", () => {
    expect(
      decideArtworkOutcome(assessProduct(product(1)), {
        existing: null,
        holderOfStockCode: entry({ zohoProductId: "other" }),
      }),
    ).toMatchObject({ outcome: "skipped", reason: "duplicate_stock_code" });
  });

  it("updates Zoho-owned fields that differ, with old and new values", () => {
    const decision = decideArtworkOutcome(assessProduct(product(1)), {
      existing: entry({ title: "Harbour", medium: "Oil" }),
      holderOfStockCode: null,
    });
    expect(decision.outcome).toBe("update");
    expect(decision.changes).toEqual({
      title: { from: "Harbour", to: "Harbour at dusk" },
      medium: { from: "Oil", to: "Oil on canvas" },
    });
    expect(decision.conflicts).toEqual([]);
  });

  it("reports a conflict, and does not call it an update of the LAX-owned field", () => {
    const decision = decideArtworkOutcome(assessProduct(product(1)), {
      existing: entry({ stockCode: "LAX-ORI-PH-GAC-26-0099" }),
      holderOfStockCode: null,
    });
    expect(decision.outcome).toBe("conflict");
    expect(decision.conflicts).toEqual([
      {
        field: "stockCode",
        zohoValue: "LAX-ORI-PH-GAC-26-0001",
        laxValue: "LAX-ORI-PH-GAC-26-0099",
      },
    ]);
    expect(decision.changes).not.toHaveProperty("stockCode");
  });

  it("is stale when the record already holds this change or a newer one", () => {
    const decision = decideArtworkOutcome(assessProduct(product(1)), {
      existing: entry({ zohoModifiedAt: new Date("2026-09-08T00:00:00.000Z") }),
      holderOfStockCode: null,
    });
    expect(decision.outcome).toBe("stale");
  });

  it("is unchanged when nothing differs", () => {
    const decision = decideArtworkOutcome(assessProduct(product(1)), {
      existing: entry(),
      holderOfStockCode: null,
    });
    expect(decision.outcome).toBe("unchanged");
  });

  it("still updates an existing record when Zoho lost its stock code", () => {
    const decision = decideArtworkOutcome(assessProduct(product(4)), {
      existing: entry({ zohoProductId: "5000000000001000004", title: "Old title" }),
      holderOfStockCode: null,
    });
    expect(decision.outcome).toBe("update");
    expect(decision.conflicts).toEqual([]);
  });
});

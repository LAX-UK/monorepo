import type { AdminEditionRunSpec } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  bulkFactsSummary,
  factsLockedBody,
  factsStatusLabel,
  lowStockTitle,
  mainRunLine,
  proofsAvailable,
  runListLabel,
  runSummaryText,
} from "./edition-run.vm";

const custom: AdminEditionRunSpec = {
  type: "custom_limited",
  size: 40,
  allocation: { buyer: 0, artist: 30, lax: 10 },
  linkedToOriginal: false,
};
const proof: AdminEditionRunSpec = {
  type: "proof",
  proofType: "ap",
  size: 3,
  owner: "artist",
  mainRunId: "11111111-1111-4111-8111-111111111111",
  proofsKeptOnMain: 3,
};

describe("edition run labels", () => {
  it("labels each run for the list", () => {
    expect(runListLabel({ type: "lax_standard" })).toBe("LAX standard 24");
    expect(runListLabel(custom)).toBe("Custom 40");
    expect(runListLabel({ type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } })).toBe(
      "Open",
    );
    expect(runListLabel(proof)).toBe("AP 3");
  });

  it("summarises the run for the editor", () => {
    expect(runSummaryText(custom)).toBe(
      "Custom limited edition of 40 · 0 buyers · 30 artist · 10 LAX",
    );
    expect(runSummaryText({ type: "lax_standard" })).toBe(
      "LAX standard: limited edition of 24 · 10 buyers · 10 artist · 4 LAX",
    );
    expect(runSummaryText(proof)).toBe("Artist's proofs, 3 · owned by the artist");
    expect(mainRunLine({ title: "Harbour at dusk", spec: { type: "lax_standard" } })).toBe(
      "Harbour at dusk, limited edition of 24",
    );
  });
});

describe("edition run states", () => {
  it("warns about low open edition stock at 3 or fewer on sale", () => {
    expect(lowStockTitle({ onSale: 2 })).toBe("2 prints on sale");
    expect(lowStockTitle({ onSale: 1 })).toBe("1 print on sale");
    expect(lowStockTitle({ onSale: 0 })).toBe("No prints on sale");
    expect(lowStockTitle({ onSale: 4 })).toBeNull();
  });

  it("explains locked facts, naming who can correct them", () => {
    expect(factsLockedBody({ paidOrderCount: 3, canCorrect: false })).toBe(
      "To correct a mistake, a shop admin can use Correct edition facts. 3 sales would be affected.",
    );
    expect(factsLockedBody({ paidOrderCount: 1, canCorrect: true })).toBe(
      "To correct a mistake, use Correct edition facts. 1 sale would be affected.",
    );
    expect(factsStatusLabel(null, String)).toEqual({ label: "Not confirmed", confirmed: false });
    expect(factsStatusLabel({ byName: "Sara M.", at: "x" }, () => "12 Oct")).toEqual({
      label: "Confirmed by Sara M., 12 Oct",
      confirmed: true,
    });
  });

  it("counts the proofs not yet listed", () => {
    expect(
      proofsAvailable({
        proofsKept: { ap: 3, pp: 1, hc: 0, bat: 1 },
        linkedListings: [{ artworkId: "a", title: "AP", spec: { ...proof, size: 2 } }],
      }),
    ).toEqual({ ap: 1, pp: 1, hc: 0 });
  });

  it("reports what a bulk facts change left out", () => {
    const summary = bulkFactsSummary(
      {
        results: [
          { artworkId: "a", outcome: "changed" },
          { artworkId: "b", outcome: "skipped", message: "Sold prints were described this way" },
        ],
      },
      (id) => (id === "b" ? "Blue study II" : "Harbour"),
    );
    expect(summary).toEqual({
      tone: "warning",
      message: "Edition facts set for 1 run; 1 run left as they were",
      details: ["Blue study II: Sold prints were described this way."],
    });
  });
});

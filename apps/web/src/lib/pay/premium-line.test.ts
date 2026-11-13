import { describe, expect, it } from "vitest";
import { premiumLineParts } from "./premium-line";

describe("premiumLineParts", () => {
  it("splits the stored invoice label into its name and how it was worked out", () => {
    expect(premiumLineParts("Buyer's premium (15% of £500,000 + 10% of £100,000)")).toEqual({
      label: "Buyer's premium",
      detail: "15% of £500,000 + 10% of £100,000",
    });
    expect(premiumLineParts("Buyer's premium (25%)")).toEqual({
      label: "Buyer's premium",
      detail: "25%",
    });
  });

  it("keeps a label with no breakdown whole", () => {
    expect(premiumLineParts("Buyer's premium")).toEqual({ label: "Buyer's premium", detail: null });
  });
});

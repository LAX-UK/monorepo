import { describe, expect, it } from "vitest";
import { lotOwnershipFromAccount } from "./reoffer-lot-ownership.js";

describe("lotOwnershipFromAccount", () => {
  const ownership = lotOwnershipFromAccount({
    isLaxOwned: async (id) => id === "lax-stock-account",
  });

  it("is LAX's when the seller account is LAX stock", async () => {
    expect(await ownership.of("lax-stock-account")).toBe("lax_owned");
  });

  it("asks the seller for every other account, and for a lot with no seller", async () => {
    expect(await ownership.of("gallery-account")).toBe("seller");
    expect(await ownership.of(null)).toBe("seller");
  });
});

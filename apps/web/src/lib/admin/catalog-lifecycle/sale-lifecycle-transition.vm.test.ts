import { describe, expect, it } from "vitest";
import { saleDeleteRequiresTypedConfirmation } from "./sale-lifecycle-transition.vm";

describe("sale-lifecycle-transition.vm", () => {
  it("requires confirmation phrase for destructive sale delete", () => {
    expect(saleDeleteRequiresTypedConfirmation("draft")).toBe(true);
    expect(saleDeleteRequiresTypedConfirmation("published")).toBe(false);
  });
});

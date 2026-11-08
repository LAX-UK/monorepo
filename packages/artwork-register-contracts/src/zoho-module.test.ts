import { describe, expect, it } from "vitest";
import { zohoModuleOf } from "./entry.js";

describe("zohoModuleOf", () => {
  it("is Print_Products for a print group LAX issued, which names its original", () => {
    expect(zohoModuleOf({ kind: "print", sourceOriginalId: "reg-orig" })).toBe("Print_Products");
  });

  it("is Products for an original and for a print that came in from Zoho with no original", () => {
    expect(zohoModuleOf({ kind: "original", sourceOriginalId: null })).toBe("Products");
    expect(zohoModuleOf({ kind: "print", sourceOriginalId: null })).toBe("Products");
  });
});

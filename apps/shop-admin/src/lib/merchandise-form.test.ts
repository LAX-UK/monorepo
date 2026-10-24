import {
  MERCHANDISE_SKU_IN_USE_MESSAGE,
  MERCHANDISE_SLUG_IN_USE_MESSAGE,
} from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  conflictField,
  slugFromTitle,
  validateNewProduct,
  validateProductFields,
  validateStockAdjustment,
  validateVariant,
} from "./merchandise-form";

describe("slugFromTitle", () => {
  it("lower-cases, drops accents and joins words with single hyphens", () => {
    expect(slugFromTitle("  Café Tote — Bag (Large)! ")).toBe("cafe-tote-bag-large");
  });

  it("returns an empty slug when nothing usable remains", () => {
    expect(slugFromTitle("!!!")).toBe("");
  });

  it("never ends on a hyphen after truncation", () => {
    const slug = slugFromTitle(`${"a".repeat(119)} b`);
    expect(slug.length).toBeLessThanOrEqual(120);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("a variant's price", () => {
  const price = (raw: string) => validateVariant({ sku: "TOTE-01", price: raw });

  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    ["0.07", 7],
    ["£1,200.00", 120000],
    [" 0 ", 0],
    ["19.99", 1999],
  ])("reads %s as %i pence", (raw, pence) => {
    expect(price(raw)).toEqual({ ok: true, value: { sku: "TOTE-01", pricePence: pence } });
  });

  it.each(["", "abc", "-1", "1.234", "1e3", "100000.01"])("rejects %j", (raw) => {
    expect(price(raw).ok).toBe(false);
  });

  it("does not read a decimal comma as pounds and pence", () => {
    // "1,20" used to become £120.00, a hundredfold slip that was accepted silently.
    expect(price("1,20").ok).toBe(false);
    expect(price("1,200")).toEqual({ ok: true, value: { sku: "TOTE-01", pricePence: 120000 } });
  });

  it("accepts the limit exactly", () => {
    expect(price("100000.00")).toEqual({
      ok: true,
      value: { sku: "TOTE-01", pricePence: 10_000_000 },
    });
  });

  it("says what a price looks like and the most it can be", () => {
    const result = price("free");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.price).toBe(
        "Enter a price in pounds, such as 12.50, up to £100,000.00.",
      );
    }
  });
});

describe("validateProductFields", () => {
  const good = { title: " Tote bag ", slug: "tote-bag", description: "  " };

  it("trims and stores a blank description as none", () => {
    expect(validateProductFields(good)).toEqual({
      ok: true,
      value: { title: "Tote bag", slug: "tote-bag", description: null },
    });
  });

  it("names each failing field", () => {
    const result = validateProductFields({ title: " ", slug: "Tote Bag", description: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(["title", "slug"]);
  });

  it("rejects an over-long description", () => {
    const result = validateProductFields({ ...good, description: "x".repeat(4001) });
    expect(result.ok).toBe(false);
  });
});

describe("validateVariant", () => {
  it("converts the price to pence", () => {
    expect(validateVariant({ sku: " TOTE-01 ", price: "15" })).toEqual({
      ok: true,
      value: { sku: "TOTE-01", pricePence: 1500 },
    });
  });

  it("reports the SKU and the price separately", () => {
    const result = validateVariant({ sku: "", price: "free" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(["sku", "price"]);
  });
});

describe("validateNewProduct", () => {
  const good = {
    title: "Tote bag",
    slug: "tote-bag",
    description: "",
    sku: "TOTE-01",
    price: "15",
    onHand: "3",
  };

  it("combines the product, first variant and opening stock", () => {
    expect(validateNewProduct(good)).toEqual({
      ok: true,
      value: {
        title: "Tote bag",
        slug: "tote-bag",
        description: null,
        sku: "TOTE-01",
        pricePence: 1500,
        onHand: 3,
      },
    });
  });

  it("collects errors from every part", () => {
    const result = validateNewProduct({ ...good, title: "", price: "", onHand: "-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["onHand", "price", "title"]);
  });
});

describe("validateStockAdjustment", () => {
  it("needs a reason", () => {
    const result = validateStockAdjustment({ onHand: "5", reason: " ok" }, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveProperty("reason");
  });

  it("refuses a count below the units held for checkouts", () => {
    const result = validateStockAdjustment({ onHand: "1", reason: "Recount" }, 2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.onHand).toContain("2 units are held");
  });

  it("accepts a count equal to the held units", () => {
    expect(validateStockAdjustment({ onHand: "2", reason: " Recount " }, 2)).toEqual({
      ok: true,
      value: { onHand: 2, reason: "Recount" },
    });
  });
});

describe("conflictField", () => {
  it("tells the slug and SKU clashes apart", () => {
    expect(conflictField(MERCHANDISE_SLUG_IN_USE_MESSAGE)).toBe("slug");
    expect(conflictField(MERCHANDISE_SKU_IN_USE_MESSAGE)).toBe("sku");
    expect(conflictField("Command already in flight")).toBeNull();
  });
});

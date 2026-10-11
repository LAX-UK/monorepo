import { describe, expect, it } from "vitest";
import {
  assertOriginalSaleCanAssign,
  assertOriginalSaleCanIssueInvoice,
  assertOriginalSaleCanMarkPaid,
} from "./original-sale-lifecycle.js";
import { ShopDomainError } from "./shop-domain-error.js";

describe("original sale lifecycle", () => {
  it("allows invoice from reserved", () => {
    expect(() => assertOriginalSaleCanIssueInvoice("reserved")).not.toThrow();
  });

  it("rejects invoice from assigned", () => {
    expect(() => assertOriginalSaleCanIssueInvoice("assigned")).toThrow(ShopDomainError);
  });

  it("allows assign only from paid", () => {
    expect(() => assertOriginalSaleCanMarkPaid("invoiced")).not.toThrow();
    expect(() => assertOriginalSaleCanAssign("paid")).not.toThrow();
    expect(() => assertOriginalSaleCanAssign("invoiced")).toThrow(ShopDomainError);
  });
});

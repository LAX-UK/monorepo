import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  assertEditionAvailableForThirdPartySale,
  assertSaleFeeCanBeApproved,
  assertThirdPartySaleParties,
} from "./sale-rules.js";

describe("assertSaleFeeCanBeApproved", () => {
  const base = { status: "pending", createdBySubjectId: "maker", actorSubjectId: "checker" };

  it("lets someone other than the creator approve a pending fee", () => {
    expect(() => assertSaleFeeCanBeApproved(base)).not.toThrow();
  });

  it("refuses the person who created the fee", () => {
    expect(() => assertSaleFeeCanBeApproved({ ...base, actorSubjectId: "maker" })).toThrowError(
      expect.objectContaining({ statusCode: 403, code: SHOP_API_ERROR_CODES.STAFF_FORBIDDEN }),
    );
  });

  it("allows approval when the creator was never recorded", () => {
    expect(() => assertSaleFeeCanBeApproved({ ...base, createdBySubjectId: null })).not.toThrow();
  });

  it.each(["approved", "rejected"])("returns 409 for a %s fee", (status) => {
    expect(() => assertSaleFeeCanBeApproved({ ...base, status })).toThrowError(
      expect.objectContaining({ statusCode: 409, code: SHOP_API_ERROR_CODES.CONFLICT }),
    );
  });

  it("reports a non-pending fee before the maker-checker rule", () => {
    expect(() =>
      assertSaleFeeCanBeApproved({ ...base, status: "approved", actorSubjectId: "maker" }),
    ).toThrowError(expect.objectContaining({ statusCode: 409 }));
  });
});

describe("third-party sale rules", () => {
  it("needs different seller and buyer", () => {
    expect(() =>
      assertThirdPartySaleParties({ sellerPartyId: "a", buyerPartyId: "b" }),
    ).not.toThrow();
    expect(() =>
      assertThirdPartySaleParties({ sellerPartyId: "a", buyerPartyId: "a" }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }));
  });

  it("needs an edition authorised for sale", () => {
    expect(() => assertEditionAvailableForThirdPartySale("authorised")).not.toThrow();
    for (const status of ["not_authorised", "reserved", "held", "sold", "withdrawn"]) {
      expect(() => assertEditionAvailableForThirdPartySale(status)).toThrowError(
        expect.objectContaining({ statusCode: 409 }),
      );
    }
  });
});

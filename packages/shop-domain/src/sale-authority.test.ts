import { describe, expect, it } from "vitest";
import {
  type EditionAuthorityRow,
  assertAuthorityReductionAllowed,
  selectEditionsToAuthorise,
} from "./sale-authority.js";

describe("selectEditionsToAuthorise", () => {
  it("skips editions in with_owner custody", () => {
    const rows: EditionAuthorityRow[] = [
      { editionNumber: 1, listingStatus: "not_authorised", custodyStatus: "with_owner" },
      { editionNumber: 2, listingStatus: "not_authorised", custodyStatus: "unprinted" },
    ];
    expect(selectEditionsToAuthorise(rows, 1)).toEqual([2]);
  });
});

describe("assertAuthorityReductionAllowed", () => {
  it("blocks negative free-authorised targets", () => {
    expect(() =>
      assertAuthorityReductionAllowed({
        newAuthorisedCount: -1,
      }),
    ).toThrow(/negative/);
  });
});

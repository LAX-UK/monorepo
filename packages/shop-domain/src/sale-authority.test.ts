import { describe, expect, it } from "vitest";
import {
  type EditionAuthorityRow,
  assertAuthorityReductionAllowed,
  authorisablePrintCount,
  selectEditionsToAuthorise,
  selectEditionsToRevokeAuthority,
} from "./sale-authority.js";

const row = (
  stockRef: number,
  listingStatus: EditionAuthorityRow["listingStatus"] = "not_authorised",
  custodyStatus: EditionAuthorityRow["custodyStatus"] = "unprinted",
): EditionAuthorityRow => ({ stockRef, listingStatus, custodyStatus });

describe("selectEditionsToAuthorise", () => {
  it("skips editions in with_owner custody", () => {
    expect(selectEditionsToAuthorise([row(1, "not_authorised", "with_owner"), row(2)], 1)).toEqual([
      2,
    ]);
  });

  it("picks the lowest stock references first, numbered or not", () => {
    expect(selectEditionsToAuthorise([row(23), row(21), row(22)], 2)).toEqual([21, 22]);
  });

  it("is not capped at 10: an owner of 30 prints can offer all 30", () => {
    const rows = Array.from({ length: 30 }, (_, index) => row(index + 1));
    expect(selectEditionsToAuthorise(rows, 30)).toHaveLength(30);
  });

  it("refuses a negative or fractional count", () => {
    expect(() => selectEditionsToAuthorise([row(1)], -1)).toThrow(/whole number/);
    expect(() => selectEditionsToAuthorise([row(1)], 1.5)).toThrow(/whole number/);
  });
});

describe("selectEditionsToRevokeAuthority", () => {
  it("revokes the highest stock references first", () => {
    const rows = [row(1, "authorised"), row(3, "authorised"), row(2, "authorised")];
    expect(selectEditionsToRevokeAuthority(rows, 2)).toEqual([3, 2]);
  });
});

describe("authorisablePrintCount", () => {
  it("counts the prints that are not sold, reserved, held or withdrawn", () => {
    expect(
      authorisablePrintCount([
        row(1),
        row(2, "authorised"),
        row(3, "sold"),
        row(4, "reserved"),
        row(5, "held"),
        row(6, "withdrawn"),
      ]),
    ).toBe(2);
  });
});

describe("assertAuthorityReductionAllowed", () => {
  it("blocks negative free-authorised targets", () => {
    expect(() =>
      assertAuthorityReductionAllowed({ newAuthorisedCount: -1, authorisableCount: 4 }),
    ).toThrow(/negative/);
  });

  it("caps the target at the prints the owner holds", () => {
    expect(() =>
      assertAuthorityReductionAllowed({ newAuthorisedCount: 31, authorisableCount: 30 }),
    ).toThrow("You can offer at most 30 prints");
    expect(() =>
      assertAuthorityReductionAllowed({ newAuthorisedCount: 30, authorisableCount: 30 }),
    ).not.toThrow();
  });
});

import { shopRefundSourceEnum } from "@auction/db/schema";
import { SHOP_REFUND_SOURCES } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";

describe("refund sources", () => {
  it("match the database enum, so a new source cannot be added to one side only", () => {
    expect([...SHOP_REFUND_SOURCES].sort()).toEqual([...shopRefundSourceEnum.enumValues].sort());
  });
});

import type { HeldSaleDto } from "@/lib/data/http/admin-seller-proceeds.shared";
import { describe, expect, it } from "vitest";
import { toHeldSaleRows } from "./held-sales.vm";
import { FIXTURE_PAYOUT_SALES } from "./seller-proceeds.fixture";

describe("toHeldSaleRows", () => {
  it("names each held sale, its seller and the reason, and offers recording where it helps", () => {
    const [row] = toHeldSaleRows(FIXTURE_PAYOUT_SALES.heldForSeller);
    expect(row).toMatchObject({
      lot: "Lot 21",
      lotTitle: "The Lock Keeper's House",
      seller: "Northbank Gallery Ltd",
      hammer: "£6,200.00",
      reason: "No signed agreement",
      record: { lot: "Lot 21", hammerPence: 620_000 },
    });
  });

  it("offers no recording when an agreement would not fix it", () => {
    const held = FIXTURE_PAYOUT_SALES.heldForSeller[0] as HeldSaleDto;
    const [row] = toHeldSaleRows([{ ...held, heldReason: "vat_setting_missing" }]);
    expect(row?.record).toBeNull();
    expect(row?.reason).toBe("VAT setting for London Auction Xchange LTD is missing");
  });
});

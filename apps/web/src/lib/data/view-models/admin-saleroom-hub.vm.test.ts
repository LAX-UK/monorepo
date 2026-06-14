import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import type { SaleDeliveryMode, SaleStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { filterSaleroomHubRows } from "./admin-saleroom-hub.vm";

function row(deliveryMode: SaleDeliveryMode, status: SaleStatus, id = "sale-1"): AdminSaleListRow {
  return {
    sale: {
      id,
      title: `${deliveryMode} sale`,
      deliveryMode,
      status,
    } as AdminSaleListRow["sale"],
    lots: [],
  };
}

describe("filterSaleroomHubRows", () => {
  it("includes active and scheduled onsite and hybrid sales", () => {
    const rows = filterSaleroomHubRows([
      row("hybrid", "active", "hybrid-active"),
      row("onsite", "scheduled", "onsite-scheduled"),
      row("online", "active", "online-active"),
      row("hybrid", "ended", "hybrid-ended"),
    ]);

    expect(rows.map((r) => r.sale.id)).toEqual(["hybrid-active", "onsite-scheduled"]);
  });
});

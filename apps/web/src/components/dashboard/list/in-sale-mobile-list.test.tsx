import type { InSaleDisplayRow } from "@/app/dashboard/seller/in-sale/in-sale.vm";
import { InSaleMobileList } from "@/components/dashboard/list/in-sale-mobile-list";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-now", () => ({
  useNow: () => Date.parse("2026-01-01T12:00:00.000Z"),
}));

function inSaleRow(id: string, title: string): InSaleDisplayRow {
  return {
    id,
    lotHref: `/lot/${id}`,
    saleHref: "/sales/s1",
    saleTitle: "Spring Sale",
    lotNumberLabel: "Lot 12",
    title,
    currentPriceLabel: "£1,200",
    reserveLabel: "Reserve met",
    reserveMet: true,
    status: "active",
    statusLabel: "Live",
    statusTone: "success",
    endTimeIso: "2026-01-02T00:00:00.000Z",
    endTimeLabel: "2 Jan 2026",
    startTimeIso: "2026-01-01T00:00:00.000Z",
    imageUrl: null,
  };
}

describe("InSaleMobileList", () => {
  it("renders a live countdown on each active lot card", () => {
    render(
      <InSaleMobileList
        rows={[inSaleRow("l1", "Blue Canvas Study"), inSaleRow("l2", "Red Landscape")]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Blue Canvas Study" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Red Landscape" })).toBeInTheDocument();
  });
});

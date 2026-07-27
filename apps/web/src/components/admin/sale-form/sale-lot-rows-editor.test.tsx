import { SaleLotRowsEditor } from "@/components/admin/sale-form/sale-lot-rows-editor";
import type { Lot, Sale } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function baseSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "sale-1",
    deliveryMode: "onsite",
    startTime: new Date("2030-06-02T10:00:00Z"),
    endTime: new Date("2030-06-08T18:00:00Z"),
    ...overrides,
  } as Sale;
}

function staleLot(): Lot {
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    title: "Blue vase",
    startTime: new Date("2030-06-01T10:00:00Z"),
    endTime: new Date("2030-06-07T18:00:00Z"),
    status: "draft",
    sellerLegalEntityId: "seller-1",
    sellerId: "seller-1",
    categoryId: "c1",
    auctionType: "english",
    startingPrice: "100",
    currentPrice: "100",
    images: [],
    marketingDetails: {},
  } as unknown as Lot;
}

describe("SaleLotRowsEditor lot window conflicts", () => {
  it("hides sync action for inherited-timing sales", () => {
    render(
      <SaleLotRowsEditor
        saleId="sale-1"
        sale={baseSale({ deliveryMode: "onsite" })}
        lots={[staleLot()]}
        categories={[]}
        artists={[]}
        englishOnlyAuctionsLocked={false}
        onLotsChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Saving this schedule will update all draft lots/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Sync lot to sale window/i }),
    ).not.toBeInTheDocument();
  });

  it("shows sync action for online sales with lot window conflicts", () => {
    render(
      <SaleLotRowsEditor
        saleId="sale-1"
        sale={baseSale({ deliveryMode: "online" })}
        lots={[staleLot()]}
        categories={[]}
        artists={[]}
        englishOnlyAuctionsLocked={false}
        onLotsChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Sync lot to sale window/i })).toBeInTheDocument();
  });
});

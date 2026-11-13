import type { SoldLot } from "@/lib/data/http/workspace-selling.schema";
import { parseSoldListQuery } from "@/lib/seller/sold-and-payouts-list";
import type { SoldAndPayoutsVm } from "@/lib/seller/sold-and-payouts.vm";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SoldAndPayoutsView } from "./sold-and-payouts-view";

vi.mock("next/navigation", () => ({
  usePathname: () => "/selling/payouts",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const lot = (id: string, over: Partial<SoldLot>): SoldLot => ({
  lotId: id,
  lotTitle: `Work ${id}`,
  lotNumber: 31,
  saleTitle: "Autumn Modern British",
  soldAt: new Date("2026-11-05T18:00:00Z"),
  hammerPrice: "82000.00",
  soldAfterAuction: false,
  stage: "buyer_paying",
  net: null,
  sellerTerms: null,
  payout: null,
  ...over,
});

const vm = (sold: SoldLot[]): SoldAndPayoutsVm => ({
  destination: { ready: true, pending: null, bank: null, bankFailed: false },
  sold,
  payouts: [],
});

function renderSold(sold: SoldLot[]) {
  render(
    <SoldAndPayoutsView
      vm={vm(sold)}
      query={parseSoldListQuery({})}
      organisation={null}
      setup={null}
    />,
  );
}

describe("SoldAndPayoutsView", () => {
  it("shows the hammer and what the seller receives, and where it stands until it is known", () => {
    renderSold([
      lot("paid", { stage: "paid_out", net: "67240.00" }),
      lot("waiting", { stage: "buyer_paying" }),
      lot("held", { stage: "paid_by_buyer" }),
    ]);
    const row = (name: string) => {
      const found = screen.getByRole("listitem", { name: new RegExp(`^Work ${name},`) });
      return found;
    };
    expect(within(row("paid")).getAllByText("£67,240.00").length).toBeGreaterThan(0);
    expect(within(row("paid")).getByText("hammer")).toBeInTheDocument();
    expect(within(row("waiting")).getAllByText(/After payment/).length).toBeGreaterThan(0);
    expect(within(row("held")).getAllByText(/Being confirmed/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        '"You receive" is the hammer less your commission and the VAT on it, as set in your signed agreement.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/premium/i)).toBeNull();
  });

  it("keeps what the seller receives on a phone, where a row shows one figure cell", () => {
    renderSold([lot("paid", { stage: "paid_out", net: "67240.00" })]);
    const row = screen.getByRole("listitem", { name: /^Work paid,/ });
    // The phone-only fact, hidden on a wide row (which shows the figure in its own cell).
    const fact = within(row).getByText("£67,240.00 you receive");
    expect(fact.closest("[data-record-fact]")?.className).toContain("@2xl:hidden");
  });
});

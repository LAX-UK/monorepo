import type { PartyDealRow } from "@/lib/private-sales/party-deals.schema";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivateSaleRows } from "./private-sale-rows";

function row(overrides: Partial<PartyDealRow> = {}): PartyDealRow {
  return {
    reference: "PS-0012",
    role: "buyer",
    stage: "invoiced",
    workTitle: "Harbour at dusk",
    workReference: "C-1042",
    priceMinor: 4_800_000,
    totalDueMinor: 4_920_000,
    netToSellerMinor: null,
    paymentDueAt: "2026-11-19T17:00:00.000Z",
    needs: "pay",
    updatedAt: "2026-11-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("PrivateSaleRows", () => {
  it("shows nothing when there are no private sales", () => {
    const { container } = render(<PrivateSaleRows rows={[]} heading="Private sales" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a buyer's deal as one row, tagged, with what is due and the one step", () => {
    render(<PrivateSaleRows rows={[row()]} heading="Private sales" />);
    const list = screen.getByRole("list", { name: "Private sales" });
    const item = within(list).getByRole("listitem");
    expect(within(item).getByText("Harbour at dusk")).toBeInTheDocument();
    expect(within(item).getByText(/Private sale/)).toBeInTheDocument();
    expect(within(item).getByText("£49,200.00")).toBeInTheDocument();
    expect(within(item).getByText("Payment due")).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: "Pay for PS-0012" })).toHaveAttribute(
      "href",
      "/private-sales/PS-0012",
    );
  });

  it("shows a seller the stage in their words and what they receive", () => {
    render(
      <PrivateSaleRows
        rows={[
          row({
            role: "seller",
            stage: "paid",
            totalDueMinor: null,
            netToSellerMinor: 4_055_000,
            needs: null,
          }),
        ]}
        heading="Private sales"
      />,
    );
    expect(screen.getByText("Buyer has paid")).toBeInTheDocument();
    expect(screen.getByText("£40,550.00")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Pay/ })).toBeNull();
  });

  it("shows no figure while the price is under discussion", () => {
    render(
      <PrivateSaleRows
        rows={[row({ stage: "offer", totalDueMinor: null, needs: "accept_terms" })]}
        heading="Private sales"
      />,
    );
    expect(screen.getByText("Offer under discussion")).toBeInTheDocument();
    expect(screen.queryByText(/£/)).toBeNull();
    expect(screen.getByRole("link", { name: "Accept the terms for PS-0012" })).toBeInTheDocument();
  });
});

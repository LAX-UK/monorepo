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

  it("on a phone, says the hammer and what the seller receives together, then the status", () => {
    renderSold([
      lot("paid", { stage: "paid_out", net: "67240.00" }),
      lot("waiting", { stage: "buyer_paying" }),
    ]);
    const paid = screen.getByRole("listitem", { name: /^Work paid,/ });
    const figures = paid.querySelector("[data-record-figures]");
    const cells = [...(figures?.children ?? [])];
    // Both cells show at every width, hammer first, each kept whole when the line wraps.
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "hammer£82,000.00",
      "you receive£67,240.00",
    ]);
    for (const cell of cells) {
      expect(cell.className).not.toMatch(/(^|\s)hidden(\s|$)/);
      expect(cell.className).toContain("whitespace-nowrap");
    }
    // The figures come first on a phone; the badge follows on its own line.
    const status = paid.querySelector("[data-record-status]");
    if (!figures || !status) throw new Error("figures and status");
    expect(status.className).not.toContain("-order-1");
    expect(figures.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Nothing is said twice in the facts.
    expect(paid.querySelector("[data-record-meta]")?.textContent).not.toMatch(/you receive/);

    // A figure not known yet reads as a fact beside the hammer: "you receive: After payment".
    const waiting = screen.getByRole("listitem", { name: /^Work waiting,/ });
    const label = within(waiting).getByText("you receive");
    expect(label.className).toContain("after:content-[':']");
    expect(label.className).toContain("@2xl:sr-only");
    expect(label.className).not.toMatch(/(^|\s)sr-only/);
  });
});

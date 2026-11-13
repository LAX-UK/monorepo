import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatBpsAsPercent } from "../lib/percent.js";
import {
  SettlementBreakdown,
  type SettlementBreakdownProps,
  sellerReceivesLabel,
  settlementStatusLabel,
} from "./settlement-breakdown.js";

const NOW = new Date("2026-11-13T12:00:00Z");

const ready: SettlementBreakdownProps = {
  hammerPence: 620_000,
  commission: { rateBps: 1200, pence: 74_400 },
  vat: { kind: "charged", rateBps: 2000, pence: 14_880 },
  netPence: 530_720,
  paidOut: false,
  status: { kind: "ready" },
  rateSource: {
    kind: "agreement",
    reference: "C-1042",
    signedAt: "2026-10-03T10:00:00Z",
    href: "/admin/consignments/agreements/c-1042",
  },
  premium: { rateLabel: "25%", buyerPaidPence: 775_000 },
  now: NOW,
};

function row(testId: string) {
  return screen.getByTestId(testId);
}

describe("SettlementBreakdown", () => {
  it("reads like a receipt: hammer, commission, VAT on commission, then what the seller receives", () => {
    render(<SettlementBreakdown {...ready} />);
    expect(row("hammer")).toHaveTextContent("Hammer price£6,200.00");
    expect(row("commission")).toHaveTextContent("Commission 12%−£744.00");
    expect(row("vat")).toHaveTextContent("VAT on commission 20%−£148.80");
    expect(row("net")).toHaveTextContent("Seller will receive£5,307.20");
    const labels = Array.from(document.querySelectorAll("dt")).map((dt) => dt.textContent);
    expect(labels).toEqual([
      "Hammer price",
      "Commission 12%",
      "VAT on commission 20%",
      "Seller will receive",
    ]);
  });

  it("shows the figures it is given and never works one out", () => {
    // Figures that do not add up are shown as given: the breakdown formats, it does not sum.
    render(<SettlementBreakdown {...ready} netPence={1} />);
    expect(row("net")).toHaveTextContent("£0.01");
  });

  it("says 'Seller received' once the sale is paid out, with the payout date on the badge", () => {
    render(<SettlementBreakdown {...ready} paidOut status={{ kind: "paid_out", paidAt: NOW }} />);
    expect(row("net")).toHaveTextContent("Seller received");
    expect(screen.getByText("Paid out 13 Nov")).toBeInTheDocument();
  });

  it("explains why no VAT is charged when the company is not VAT-registered", () => {
    render(
      <SettlementBreakdown
        {...ready}
        vat={{ kind: "not_registered", companyName: "London Auction Xchange LTD" }}
        netPence={545_600}
      />,
    );
    expect(row("vat")).toHaveTextContent(
      "No VAT: London Auction Xchange LTD is not VAT-registered£0.00",
    );
  });

  it("links the rate to the signed agreement with its signing date", () => {
    render(<SettlementBreakdown {...ready} />);
    const link = screen.getByRole("link", { name: "Agreement C-1042" });
    expect(link).toHaveAttribute("href", "/admin/consignments/agreements/c-1042");
    expect(link.parentElement).toHaveTextContent("Agreement C-1042 · signed 3 Oct 2026");
  });

  it("says when staff recorded the rate", () => {
    render(<SettlementBreakdown {...ready} rateSource={{ kind: "recorded_by_staff" }} />);
    expect(screen.getByText("Recorded by staff")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps the buyer's premium out of the seller's figures, at the invoice's own rate", () => {
    render(
      <SettlementBreakdown {...ready} premium={{ rateLabel: "20%", buyerPaidPence: 744_000 }} />,
    );
    expect(
      screen.getByText(
        "Buyer's premium 20% is kept by LAX and isn't part of the seller's proceeds. The buyer paid £7,440.00.",
      ),
    ).toBeInTheDocument();
    expect(within(document.querySelector("dl") as HTMLElement).queryByText(/premium/i)).toBeNull();
  });

  it("shows an em dash for figures a held sale does not have yet", () => {
    render(
      <SettlementBreakdown
        {...ready}
        commission={null}
        vat={null}
        netPence={null}
        rateSource={null}
        status={{ kind: "held" }}
      />,
    );
    expect(row("commission")).toHaveTextContent("Commission—");
    expect(row("net")).toHaveTextContent("Seller will receive—");
    expect(screen.getByText("Payout held")).toBeInTheDocument();
  });

  it("renders the note and the action under the figures", () => {
    render(
      <SettlementBreakdown
        {...ready}
        status={{ kind: "settle_by_hand" }}
        note="Sold through ATG."
        action={<button type="button">Mark as settled outside LAX</button>}
      />,
    );
    expect(screen.getByText("Sold through ATG.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as settled outside LAX" })).toBeInTheDocument();
  });
});

describe("settlementStatusLabel", () => {
  it.each([
    [{ kind: "ready" } as const, "Ready for payout"],
    [{ kind: "waiting_for_buyer" } as const, "Waiting for the buyer"],
    [{ kind: "paid_out", paidAt: "2026-11-13T09:00:00Z" } as const, "Paid out 13 Nov"],
    [{ kind: "held" } as const, "Payout held"],
    [{ kind: "recalculated" } as const, "Recalculated"],
    [{ kind: "re_awarded" } as const, "Re-awarded"],
    [{ kind: "lax_owned" } as const, "LAX-owned"],
    [{ kind: "refunded_after_payout" } as const, "Refunded after payout"],
    [{ kind: "settle_by_hand" } as const, "Settle by hand"],
  ])("%o reads %s", (status, label) => {
    expect(settlementStatusLabel(status, NOW)).toBe(label);
  });

  it("adds the year to a payout date from another year", () => {
    expect(settlementStatusLabel({ kind: "paid_out", paidAt: "2025-11-13T09:00:00Z" }, NOW)).toBe(
      "Paid out 13 Nov 2025",
    );
  });
});

describe("sellerReceivesLabel", () => {
  it("reads in the future until the payout and in the past after it", () => {
    expect(sellerReceivesLabel(false)).toBe("Seller will receive");
    expect(sellerReceivesLabel(true)).toBe("Seller received");
  });
});

describe("formatBpsAsPercent", () => {
  it.each([
    [1200, "12%"],
    [1250, "12.5%"],
    [1225, "12.25%"],
    [5, "0.05%"],
    [0, "0%"],
    [10_000, "100%"],
  ])("%i bps is %s", (bps, text) => {
    expect(formatBpsAsPercent(bps)).toBe(text);
  });
});

describe("SettlementBreakdown accessibility", () => {
  it.each<[string, Partial<SettlementBreakdownProps>]>([
    ["ready", {}],
    ["held", { status: { kind: "held" }, commission: null, vat: null, netPence: null }],
    ["paid out", { status: { kind: "paid_out", paidAt: "2026-11-12T09:00:00Z" }, paidOut: true }],
    [
      "priced on an earlier version",
      {
        rateSource: {
          kind: "agreement",
          reference: "C-1042",
          signedAt: "2026-10-03T10:00:00Z",
          href: "/admin/inbox/sub-1",
          earlierVersion: true,
        },
      },
    ],
  ])("has no axe violations when %s", async (_name, over) => {
    const axe = (await import("axe-core")).default;
    const { container } = render(<SettlementBreakdown {...ready} {...over} />);
    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      // jsdom does not lay out or paint, so contrast is checked in the browser captures.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe("SettlementBreakdown agreement version", () => {
  it("says the sale was priced on an earlier version next to the reference", () => {
    render(
      <SettlementBreakdown
        {...ready}
        rateSource={{
          kind: "agreement",
          reference: "C-1042",
          signedAt: "2026-10-03T10:00:00Z",
          href: "/admin/inbox/sub-1",
          earlierVersion: true,
        }}
      />,
    );
    expect(screen.getByText(/Agreement C-1042/).closest("p")).toHaveTextContent(
      "Agreement C-1042 · signed 3 Oct 2026 · Priced on an earlier version of this agreement",
    );
  });

  it("names a recorded agreement by its reference when it has one", () => {
    render(
      <SettlementBreakdown
        {...ready}
        rateSource={{
          kind: "recorded_by_staff",
          reference: "C-1042",
          href: "/admin/inbox/sub-1",
          earlierVersion: true,
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Agreement C-1042" })).toBeInTheDocument();
    expect(screen.getByText(/recorded by staff/)).toHaveTextContent(
      "· recorded by staff · Priced on an earlier version of this agreement",
    );
  });

  it("says nothing extra while the agreement is the one the sale was priced on", () => {
    render(<SettlementBreakdown {...ready} />);
    expect(screen.queryByText(/earlier version/)).not.toBeInTheDocument();
  });
});

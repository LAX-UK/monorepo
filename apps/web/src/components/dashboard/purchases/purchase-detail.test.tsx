// The device is in London: a visitor elsewhere has chosen their zone.
process.env.TZ = "Europe/London";

import type { PurchaseCardVm } from "@/lib/purchases/purchases.vm";
import { renderAsVisitorIn, setViewerZone } from "@/test/viewer-zone";
import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/purchases/purchase.actions", () => ({}));
vi.mock("./delivery-panel", () => ({ DeliveryPanel: () => null }));

import { PurchaseDetail } from "./purchase-detail";

const DUE = { iso: "2026-11-18T23:59:00.000Z", zone: "Europe/London" };

function card(over: Partial<PurchaseCardVm> = {}): PurchaseCardVm {
  return {
    lotId: "l6",
    detailHref: "/purchases/l6",
    lotHref: "/lots/l6",
    image: null,
    title: "Blue Abstract No. 3",
    lotLabel: "Lot 6",
    saleId: "s1",
    saleTitle: "Winter Evening Sale",
    wonBy: null,
    tab: "to-pay",
    state: "payment-due",
    badge: { label: "Payment due", tone: "warning", shape: "dot" },
    statusLabel: "Payment due",
    statusNote: "Pay by Wed 18 Nov, 23:59 GMT",
    dueMoment: DUE,
    amountLabel: "total due",
    amount: "£7,875.00",
    informed: false,
    payable: { totalDue: "7875", currency: "GBP" },
    dueAt: 0,
    wonAt: 0,
    steps: [
      { id: "won", label: "Won", date: "11 Nov", progress: "done" },
      { id: "payment", label: "Payment", date: "Due 18 Nov", progress: "current" },
      { id: "delivery", label: "Delivery", date: null, progress: "upcoming" },
      { id: "delivered", label: "Delivered", date: null, progress: "upcoming" },
    ],
    breakdown: [],
    primaryAction: null,
    invoiceHref: null,
    problemHref: null,
    ...over,
  };
}

const page = (c: PurchaseCardVm) => (
  <PurchaseDetail
    card={c}
    subtitle="Lot 6"
    panel={null}
    problem={null}
    shipperEmail="hello@lax.bid"
    invoiceCard={{
      kind: "lax",
      download: null,
      empty: "The invoice appears here once it is raised.",
    }}
  />
);

afterEach(() => setViewerZone(null));

describe("PurchaseDetail's due line", () => {
  it("keeps the deadline on the London day and adds the visitor's time in a chip", () => {
    renderAsVisitorIn("America/New_York", page(card()));
    const due = screen.getByText("Pay by Wed 18 Nov, 23:59 GMT");
    expect(due.tagName).toBe("TIME");
    expect(due).toHaveAttribute("datetime", DUE.iso);
    expect(screen.getByRole("button", { name: /show details/i })).toHaveTextContent(
      "18:59 in New York",
    );
  });

  it("names the next day for a visitor ahead of London", () => {
    renderAsVisitorIn("Africa/Cairo", page(card()));
    expect(screen.getByRole("button", { name: /show details/i })).toHaveTextContent(
      "Thu 19 Nov, 01:59 in Cairo",
    );
  });

  it.each(["Europe/London", "UTC", null])("adds nothing for %s", (zone) => {
    renderAsVisitorIn(zone, page(card()));
    expect(screen.getByText("Pay by Wed 18 Nov, 23:59 GMT")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show details/i })).toBeNull();
  });

  it("shows the note as it is when it quotes no deadline", () => {
    renderAsVisitorIn(
      "Africa/Cairo",
      page(card({ dueMoment: null, statusNote: "Waiting for payment by Northbank Gallery" })),
    );
    expect(screen.getByText("Waiting for payment by Northbank Gallery")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show details/i })).toBeNull();
  });
});

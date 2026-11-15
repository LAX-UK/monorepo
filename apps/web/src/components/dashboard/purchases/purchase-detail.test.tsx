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
      { id: "won", label: "Won at auction", date: "11 Nov", progress: "done" },
      { id: "payment", label: "Pay the invoice", date: "Due 18 Nov", progress: "current" },
      { id: "delivery", label: "Delivery", date: null, progress: "upcoming" },
      { id: "delivered", label: "Received", date: null, progress: "upcoming" },
    ],
    breakdown: [],
    primaryAction: null,
    invoiceHref: null,
    problemHref: null,
    collectBy: null,
    collection: null,
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

describe("PurchaseDetail's collect-by notice", () => {
  const collectBy = (state: "upcoming" | "soon" | "overdue") => ({
    day: "Wed 9 Dec",
    short: "Collect by Wed 9 Dec",
    title: "Please collect by Wed 9 Dec",
    body:
      state === "overdue"
        ? "That day has passed, so storage charges may apply."
        : "Your work is paid for and waiting at LAX Marylebone.",
    state,
    placeId: "v1",
    placeName: "LAX Marylebone",
    bookHref: "/purchases/collect?lots=l6",
  });

  it.each(["upcoming", "soon", "overdue"] as const)(
    "says please collect by the day when %s",
    (state) => {
      renderAsVisitorIn(null, page(card({ collectBy: collectBy(state) })));
      expect(screen.getByText("Please collect by Wed 9 Dec")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Book a collection time" })).toHaveAttribute(
        "href",
        "/purchases/collect?lots=l6",
      );
    },
  );

  it("links the storage policy, and the gallery's email once the day has passed", () => {
    const soon = renderAsVisitorIn(null, page(card({ collectBy: collectBy("soon") })));
    expect(screen.getByRole("link", { name: "Storage policy" })).toHaveAttribute(
      "href",
      "/shipping#storage",
    );
    expect(screen.queryByRole("link", { name: /^Email / })).toBeNull();
    soon.unmount();
    renderAsVisitorIn(null, page(card({ collectBy: collectBy("overdue") })));
    expect(screen.getByRole("link", { name: /^Email .+@/ }).getAttribute("href")).toMatch(
      /^mailto:/,
    );
  });

  it("says the day has passed once overdue, and not before", () => {
    const overdue = renderAsVisitorIn(null, page(card({ collectBy: collectBy("overdue") })));
    expect(screen.getByText(/That day has passed/)).toBeInTheDocument();
    overdue.unmount();
    renderAsVisitorIn(null, page(card({ collectBy: collectBy("soon") })));
    expect(screen.queryByText(/That day has passed/)).toBeNull();
  });

  it("is calm while upcoming and a warning once soon or overdue", () => {
    const tone = (state: "upcoming" | "soon" | "overdue") => {
      const view = renderAsVisitorIn(null, page(card({ collectBy: collectBy(state) })));
      const notice = screen.getByText("Please collect by Wed 9 Dec").closest("[role=status]");
      const className = notice?.className ?? "";
      view.unmount();
      return className;
    };
    expect(tone("upcoming")).toContain("lax-info");
    expect(tone("soon")).toContain("lax-warning");
    expect(tone("overdue")).toContain("lax-warning");
  });

  it("shows nothing when the purchase is booked or collected", () => {
    renderAsVisitorIn(null, page(card({ collectBy: null })));
    expect(screen.queryByText(/Please collect by/)).toBeNull();
  });
});

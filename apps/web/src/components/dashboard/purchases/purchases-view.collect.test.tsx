import type { PurchaseCardVm, PurchasesVm } from "@/lib/purchases/purchases.vm";
import { fireEvent, render, screen } from "@testing-library/react";

import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/purchases",
  useSearchParams: () => new URLSearchParams(),
}));

import { PurchasesView } from "./purchases-view";

function card(
  lotId: string,
  place: string | null,
  over: Partial<PurchaseCardVm> = {},
): PurchaseCardVm {
  return {
    lotId,
    detailHref: `/purchases/${lotId}`,
    lotHref: `/lots/${lotId}`,
    image: null,
    title: `Work ${lotId}`,
    lotLabel: null,
    saleId: "s1",
    saleTitle: "Winter sale",
    wonBy: null,
    tab: "in-progress",
    state: "ready-for-collection",
    badge: { label: "Ready to collect", tone: "success", shape: "dot" },
    statusLabel: "Paid",
    statusNote: null,
    dueMoment: null,
    amountLabel: "paid",
    amount: "£100.00",
    informed: false,
    payable: null,
    dueAt: 0,
    wonAt: 0,
    steps: null,
    breakdown: [],
    primaryAction: null,
    invoiceHref: null,
    problemHref: null,
    collectBy: place
      ? {
          day: "Wed 9 Dec",
          short: "Collect by Wed 9 Dec",
          title: "Please collect by Wed 9 Dec",
          body: "",
          state: "upcoming",
          placeName: place,
          bookHref: `/purchases/collect?lots=${lotId}`,
        }
      : null,
    collection: place
      ? {
          state: "upcoming",
          label: "Collect by Wed 9 Dec",
          tone: "neutral",
          shape: "ring",
          title: "Please collect by Wed 9 Dec",
        }
      : null,
    ...over,
  };
}

function vmOf(cards: PurchaseCardVm[]): PurchasesVm {
  return {
    total: cards.length,
    truncated: false,
    payNow: null,
    sales: [],
    winners: [],
    cardsByTab: { "to-pay": [], "in-progress": cards, completed: [] },
  } as unknown as PurchasesVm;
}

const QUERY = { view: "in-progress", sort: "newest", q: "", sale: null, wonBy: null } as never;

function renderView(cards: PurchaseCardVm[]) {
  return render(
    <PurchasesView vm={vmOf(cards)} query={QUERY} organisation="Acme" offersSales={false} />,
  );
}

describe("Purchases: book several lots in one visit", () => {
  it("hands the picked lots at one place to the booking page together", () => {
    renderView([card("a", "LAX Marylebone"), card("b", "LAX Marylebone"), card("c", null)]);
    expect(screen.queryByRole("checkbox", { name: "Collect Work c" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Collect Work a" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Collect Work b" }));
    expect(screen.getByText("2 lots at LAX Marylebone, in one visit")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book a collection time for 2 lots" })).toHaveAttribute(
      "href",
      "/purchases/collect?lots=a,b",
    );
  });

  it("says so and holds the action back when the lots wait at different places", () => {
    renderView([card("a", "LAX Marylebone"), card("b", "Other place")]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Collect Work a" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Collect Work b" }));
    expect(screen.getByText(/different places/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Book a collection time for/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Book a collection time" })).toBeDisabled();
  });

  it("clears the bar when the selection is cleared", () => {
    renderView([card("a", "LAX Marylebone")]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Collect Work a" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByLabelText("Selected lots to collect")).toBeNull();
  });
});

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
  /** The venue id; each name is its own venue unless a test says otherwise. */
  placeId = `venue-${place}`,
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
          placeId,
          placeName: place,
          storage: null,
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
    expect(screen.queryByRole("checkbox", { name: "Add Work c to a collection visit" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Add Work a to a collection visit" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Add Work b to a collection visit" }));
    expect(screen.getByText("2 lots at LAX Marylebone, in one visit")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book a collection time for 2 lots" })).toHaveAttribute(
      "href",
      "/purchases/collect?lots=a,b",
    );
  });

  it("says so and holds the action back when the lots wait at different places", () => {
    renderView([card("a", "LAX Marylebone"), card("b", "Other place")]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Add Work a to a collection visit" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Add Work b to a collection visit" }));
    const reason = screen.getByText(
      "These lots wait at LAX Marylebone and Other place. Pick lots from one place to book them together.",
    );
    expect(reason).toHaveAttribute("aria-live", "polite");
    expect(reason.tagName).toBe("OUTPUT");
    expect(screen.queryByRole("link", { name: /Book a collection time for/ })).toBeNull();
    // Unavailable but still reachable by Tab, and pointing at the reason.
    const action = screen.getByRole("button", { name: "Book a collection time" });
    expect(action).not.toBeDisabled();
    expect(action).toHaveAttribute("aria-disabled", "true");
    expect(action).toHaveAccessibleDescription(reason.textContent ?? "");
  });

  it("holds the action back for two venues that share a name", () => {
    renderView([card("a", "LAX Gallery", {}, "venue-1"), card("b", "LAX Gallery", {}, "venue-2")]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Add Work a to a collection visit" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Add Work b to a collection visit" }));
    expect(screen.getByText(/different places called LAX Gallery/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Book a collection time for/ })).toBeNull();
  });

  it("says a visit is full on the pick past the server's limit", () => {
    const cards = Array.from({ length: 21 }, (_, i) => card(`l${i}`, "LAX Marylebone"));
    renderView(cards);
    for (const each of cards.slice(0, 20)) {
      fireEvent.click(
        screen.getByRole("checkbox", { name: `Add ${each.title} to a collection visit` }),
      );
    }
    expect(screen.getByRole("link", { name: "Book a collection time for 20 lots" })).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Add Work l20 to a collection visit" }));
    expect(
      screen.getByText("A visit holds up to 20 lots. Pick fewer, or book in two visits."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Book a collection time" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("clears the bar when the selection is cleared", () => {
    renderView([card("a", "LAX Marylebone")]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Add Work a to a collection visit" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByLabelText("Selected lots to collect")).toBeNull();
  });

  it("lets go of Pay picks when a lot is picked to collect, and the reverse, saying so", () => {
    const payable = card("p", null, {
      title: "Work p",
      payable: { totalDue: "100.00", currency: "GBP" },
    });
    renderView([payable, card("a", "LAX Marylebone")]);
    const payBox = screen.getByRole("checkbox", { name: "Pay Work p" });
    const collectBox = screen.getByRole("checkbox", { name: "Add Work a to a collection visit" });

    fireEvent.click(payBox);
    expect(screen.getByLabelText("Selected invoices")).toBeInTheDocument();

    fireEvent.click(collectBox);
    expect(payBox).not.toBeChecked();
    expect(collectBox).toBeChecked();
    expect(screen.queryByLabelText("Selected invoices")).toBeNull();
    expect(screen.getByLabelText("Selected lots to collect")).toBeInTheDocument();
    expect(
      screen.getByText("1 invoice picked to pay was unpicked. Pay and collect one at a time."),
    ).toHaveAttribute("aria-live", "polite");

    fireEvent.click(payBox);
    expect(collectBox).not.toBeChecked();
    expect(screen.queryByLabelText("Selected lots to collect")).toBeNull();
    expect(screen.getByLabelText("Selected invoices")).toBeInTheDocument();
    expect(
      screen.getByText("1 lot picked to collect was unpicked. Pay and collect one at a time."),
    ).toBeInTheDocument();
  });
});

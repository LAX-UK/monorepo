import { buildPayPageVm } from "@/lib/pay/pay-page.vm";
import { LOT_A, LOT_B, NOW, payable, planOf } from "@/lib/pay/pay-plan-fixtures.test-util";
import type { PayPlan } from "@auction/types";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));
vi.mock("@/lib/shell/shell-chrome-context", () => ({ HideBottomTabBarWhileMounted: () => null }));

const payAction = vi.fn();
vi.mock("@/lib/pay/pay.actions", () => ({
  payAction: (...args: unknown[]) => payAction(...args),
}));

import { PayPage } from "./pay-page";

const draw = (plan: PayPlan, returned: "cancelled" | null = null) =>
  render(
    <PayPage
      vm={buildPayPageVm(plan, NOW, {
        returnTo: "/purchases/pay?lots=a",
        contactHref: "/contact",
        returned,
        details: {},
      })}
    />,
  );

const assign = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign },
  });
});

const ready = () =>
  planOf([payable(LOT_A, 190_000, 47_500, { title: "Coastal Notation" })], {
    leftOut: [],
  });

describe("the Pay page, ready to pay", () => {
  it("has one h1, labelled panels, the money as stated and the company", () => {
    draw(ready());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pay for Coastal Notation");
    const payment = screen.getByRole("region", { name: "Payment" });
    expect(within(payment).getByText("Hammer price")).toBeInTheDocument();
    expect(within(payment).getByText("£1,900.00")).toBeInTheDocument();
    // The premium's rate sits on a muted second line under its name.
    expect(within(payment).getByText("Buyer's premium")).toBeInTheDocument();
    expect(within(payment).getByText("25%")).toBeInTheDocument();
    expect(within(payment).getByText("Total to pay")).toBeInTheDocument();
    expect(within(payment).getByText("£2,375.00", { selector: "dd" })).toBeInTheDocument();
    expect(
      within(payment).getByText(/Invoice from London Auction Xchange LTD/),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Lot" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Delivery" })).toBeInTheDocument();
  });

  it("stacks the lot and delivery panels so the rail's height never opens a gap between them", () => {
    draw(ready());
    const lot = screen.getByRole("region", { name: "Lot" });
    const grid = lot.parentElement?.parentElement as HTMLElement;
    expect(grid.className).toContain("lg:grid-rows-[auto_1fr]");
    expect(grid.className).toContain("lg:items-start");
  });

  it("links the Conditions instead of asking for a checkbox", () => {
    draw(ready());
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("link", { name: "Conditions of Business" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  it("sends only the lots and the total that were shown, then goes to the payment page", async () => {
    payAction.mockResolvedValue({ kind: "redirect", url: "https://checkout.stripe.com/c/pay_1" });
    draw(ready());
    fireEvent.click(screen.getAllByRole("button", { name: /Pay/ })[0] as HTMLElement);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay_1"));
    expect(payAction).toHaveBeenCalledExactlyOnceWith({
      lotIds: [LOT_A],
      expectedTotalPence: 237_500,
      method: "card",
    });
  });

  it("shows the new total and reads the page again when the plan changed, charging nothing", async () => {
    payAction.mockResolvedValue({
      kind: "changed",
      message: "The total has changed to £2,400.00. Check it and pay again.",
    });
    draw(ready());
    fireEvent.click(screen.getAllByRole("button", { name: /Pay/ })[0] as HTMLElement);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The total has changed to £2,400.00. Check it and pay again.");
    expect(refresh).toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(alert.parentElement).toHaveFocus();
  });

  it("says why it failed, and that nothing was charged", async () => {
    payAction.mockResolvedValue({
      kind: "failed",
      message: "We couldn't open the secure payment page. Nothing was charged.",
      refresh: false,
    });
    draw(ready());
    fireEvent.click(screen.getAllByRole("button", { name: /Pay/ })[0] as HTMLElement);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Nothing was charged/);
    expect(refresh).not.toHaveBeenCalled();
    // The button is usable again. The alert is shown by the answer's own update; the transition
    // that wraps the action settles a render later, so the name is awaited, not read at once.
    expect(
      (await screen.findAllByRole("button", { name: /Pay £2,375.00/ })).length,
    ).toBeGreaterThan(0);
  });

  it("offers the phone bar the same action with the total beside it", () => {
    const { container } = draw(ready());
    const bar = container.querySelector("[data-pay-phone-bar]") as HTMLElement;
    expect(within(bar).getByText("£2,375.00")).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Pay £2,375.00" })).toBeInTheDocument();
  });
});

describe("the Pay page, delivery", () => {
  const courier = {
    lotId: LOT_A,
    quoteId: "quote-1",
    amountPence: 18_000,
    destination: "12 Vyner Street, London E2 9DG",
    note: null,
  };

  it("says the choice comes after paying, and links to a quote while one can still join", () => {
    draw(
      planOf([payable(LOT_A, 190_000, 47_500, { title: "Coastal Notation" })], {
        deliveryInPayment: true,
      }),
    );
    const delivery = screen.getByRole("region", { name: "Delivery" });
    expect(within(delivery).getByText("Choose after paying")).toBeInTheDocument();
    expect(within(delivery).getByRole("link", { name: "Get a courier quote" })).toHaveAttribute(
      "href",
      `/purchases/${LOT_A}`,
    );
    expect(within(delivery).getByText(/added to this payment/)).toBeInTheDocument();
  });

  it("offers no quote link while delivery is not charged with the payment", () => {
    draw(ready());
    const delivery = screen.getByRole("region", { name: "Delivery" });
    expect(within(delivery).queryByRole("link", { name: "Get a courier quote" })).toBeNull();
  });

  it("shows an accepted courier quote as a charge, a payment line and part of the total", () => {
    draw(
      planOf([payable(LOT_A, 190_000, 47_500, { title: "Coastal Notation" })], {
        deliveryInPayment: true,
        delivery: [courier],
      }),
    );
    const delivery = screen.getByRole("region", { name: "Delivery" });
    expect(within(delivery).getByText("Courier · £180.00")).toBeInTheDocument();
    expect(within(delivery).getByText(/Insured courier to 12 Vyner Street/)).toBeInTheDocument();
    const payment = screen.getByRole("region", { name: "Payment" });
    expect(within(payment).getByText("Courier delivery")).toBeInTheDocument();
    expect(within(payment).getByText("£2,555.00", { selector: "dd" })).toBeInTheDocument();
  });

  it("sends the total shown, delivery included, and nothing else it worked out", async () => {
    payAction.mockResolvedValue({ kind: "redirect", url: "https://pay.example/cs" });
    draw(
      planOf([payable(LOT_A, 190_000, 47_500)], { deliveryInPayment: true, delivery: [courier] }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: /^Pay £2,555.00/ })[0] as HTMLElement);
    await waitFor(() => expect(payAction).toHaveBeenCalled());
    expect(payAction).toHaveBeenCalledExactlyOnceWith({
      lotIds: [LOT_A],
      expectedTotalPence: 255_500,
      method: "card",
    });
  });
});

describe("the Pay page, several lots", () => {
  it("lists each lot with its total and pays them in one payment", async () => {
    payAction.mockResolvedValue({ kind: "redirect", url: "https://checkout.stripe.com/c/pay_2" });
    draw(
      planOf([
        payable(LOT_A, 100_000, 25_000, { title: "Red Kite" }),
        payable(LOT_B, 200_000, 50_000, { title: "Estuary" }),
      ]),
    );
    const lots = screen.getByRole("region", { name: "Lots (2 invoices)" });
    expect(within(lots).getAllByRole("listitem")).toHaveLength(2);
    expect(within(lots).getByRole("link", { name: "Red Kite" })).toHaveAttribute(
      "href",
      `/purchases/${LOT_A}`,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Pay £3,750.00/ })[0] as HTMLElement);
    await waitFor(() =>
      expect(payAction).toHaveBeenCalledWith({
        lotIds: [LOT_A, LOT_B],
        expectedTotalPence: 375_000,
        method: "card",
      }),
    );
  });
});

describe("the Pay page, held", () => {
  const held = (gate: PayPlan["gate"]) => draw(planOf([payable(LOT_A, 190_000, 47_500)], { gate }));

  it.each([
    ["identity", { kind: "held", reason: "identity_verification_required" } as const],
    [
      "source of funds",
      { kind: "compliance", reason: "source_of_funds_required", subject: "payer" } as const,
    ],
    ["finance check", { kind: "finance_check" } as const],
    ["organisation review", { kind: "held", reason: "organisation_under_review" } as const],
    ["setup", { kind: "onboarding_required" } as const],
  ])("never offers a way to pay for %s, and keeps the money visible", (_name, gate) => {
    const { container } = held(gate);
    // At most a Pay that cannot be pressed (identity); never one that can.
    for (const button of screen.queryAllByRole("button", { name: /^Pay/ })) {
      expect(button).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(button);
    }
    expect(payAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Opening/ })).toBeNull();
    expect(screen.getByText("£2,375.00", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(container.querySelector("[data-pay-phone-bar]")?.textContent ?? "").not.toMatch(/Pay £/);
  });

  it("gives the identity step as a link, in the notice and on the phone bar", () => {
    const { container } = held({ kind: "held", reason: "identity_verification_required" });
    const links = screen.getAllByRole("link", { name: "Verify identity" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", expect.stringContaining("/verify-identity?next="));
    }
    expect(container.querySelector("[data-pay-phone-bar]")).not.toBeNull();
    // On a phone the bar offers it, so the notice does not show it a second time.
    expect(links[0]?.className).toContain("max-lg:hidden");
    expect(links[1]?.className).not.toContain("max-lg:hidden");
  });

  it("shows Pay disabled in the rail while identity is open, with the reason beside it", () => {
    held({ kind: "held", reason: "identity_verification_required" });
    const pay = screen.getByRole("button", { name: "Pay £2,375.00" });
    expect(pay).toHaveAttribute("aria-disabled", "true");
    expect(pay).toHaveAttribute("aria-describedby", "pay-rail-reason");
    expect(
      screen.getByText("Verify your identity to pay", { selector: "#pay-rail-reason" }),
    ).toBeInTheDocument();
  });

  it("has no phone bar when there is no next step to take", () => {
    const { container } = held({ kind: "finance_check" });
    expect(container.querySelector("[data-pay-phone-bar]")).toBeNull();
  });
});

describe("the Pay page, other states", () => {
  it("tells a buyer agent who pays, with no action", () => {
    draw(
      planOf([payable(LOT_A, 100_000, 25_000)], {
        payerRole: "informed",
        gate: { kind: "not_payer", payingAccountName: "Northbank Gallery" },
      }),
    );
    expect(screen.getByText("Northbank Gallery pays for this lot")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a payment being confirmed with a way to refresh", () => {
    draw(planOf([], { leftOut: [{ lotId: LOT_A, reason: "being_confirmed" }] }));
    expect(screen.getByText("Confirming your payment")).toBeInTheDocument();
    expect(screen.getByText("Confirming payment")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Refresh" })).toHaveAttribute(
      "href",
      "/purchases/pay?lots=a",
    );
    expect(screen.queryByRole("button", { name: /Pay/ })).toBeNull();
  });

  it("shows the empty state when nothing is left to pay", () => {
    draw(
      planOf([], {
        leftOut: [
          { lotId: LOT_A, reason: "paid" },
          { lotId: LOT_B, reason: "paid" },
        ],
      }),
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pay");
    expect(screen.getByRole("heading", { level: 2, name: "Nothing to pay" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open purchases" })).toHaveAttribute(
      "href",
      "/purchases",
    );
  });

  it("keeps the rest payable and says what was left out", () => {
    draw(
      planOf([payable(LOT_A, 100_000, 25_000)], {
        leftOut: [{ lotId: LOT_B, reason: "other_account" }],
      }),
    );
    expect(screen.getByText("One lot in this link isn't yours to pay")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Pay £1,250.00/ }).length).toBeGreaterThan(0);
  });
});

describe("the Pay page, a payment already open", () => {
  it("says so, and that it is finished on the payment page", () => {
    draw(planOf([], { leftOut: [{ lotId: LOT_A, reason: "being_paid" }] }));
    expect(screen.getByText("A payment for this is already open")).toBeInTheDocument();
    expect(screen.queryByText("Confirming your payment")).toBeNull();
    expect(screen.queryByRole("button", { name: /Pay/ })).toBeNull();
  });
});

describe("the Pay page, a single lot", () => {
  it("says the due day and the total once each, not again in the lot row", () => {
    draw(ready());
    const lot = screen.getByRole("region", { name: "Lot" });
    expect(within(lot).queryByText(/Due by/)).toBeNull();
    expect(within(lot).queryByText("£2,375.00")).toBeNull();
    expect(screen.getAllByText("£2,375.00", { selector: "dd" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Back to purchase/ })).toHaveAttribute(
      "href",
      `/purchases/${LOT_A}`,
    );
  });

  it("puts the phone bar's button name on the amount", () => {
    const { container } = draw(ready());
    const bar = container.querySelector("[data-pay-phone-bar]") as HTMLElement;
    expect(within(bar).getByRole("button", { name: "Pay £2,375.00" })).toHaveTextContent("Pay");
  });
});

describe("the Pay page, back from the payment page without paying", () => {
  it("shows that nothing was charged once, then takes it out of the address", async () => {
    draw(ready(), "cancelled");
    const note = screen.getByRole("alert");
    expect(note).toHaveTextContent("Payment not completed");
    expect(note).toHaveTextContent(/You were not charged/);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledExactlyOnceWith("/purchases/pay?lots=a", { scroll: false }),
    );
    // The note stays on screen: it is state, not the address.
    expect(screen.getByRole("alert")).toHaveTextContent("Payment not completed");
  });

  it("does not touch the address when nothing was returned", () => {
    draw(ready());
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("is replaced by the new total when a later payment attempt finds the plan changed", async () => {
    payAction.mockResolvedValue({
      kind: "changed",
      message: "The total has changed to £2,400.00. Check it and pay again.",
    });
    draw(ready(), "cancelled");
    fireEvent.click(screen.getAllByRole("button", { name: /Try again/ })[0] as HTMLElement);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("The total has changed to £2,400.00"),
    );
    expect(screen.queryByText(/Payment not completed/)).toBeNull();
  });

  it("names the phone bar's button by the amount, except while it is opening the payment", async () => {
    payAction.mockReturnValue(new Promise(() => {}));
    const { container } = draw(ready());
    const bar = container.querySelector("[data-pay-phone-bar]") as HTMLElement;
    const button = within(bar).getByRole("button", { name: "Pay £2,375.00" });
    fireEvent.click(button);
    await waitFor(() =>
      expect(
        within(bar).getByRole("button", { name: "Opening secure payment…" }),
      ).toBeInTheDocument(),
    );
    expect(within(bar).getByRole("button")).not.toHaveAttribute("aria-label");
  });

  it("keeps Try again on the card action while the note is on screen, after the address is cleaned", () => {
    const context = {
      returnTo: "/purchases/pay?lots=a",
      contactHref: "/contact",
      details: {},
    };
    const { rerender } = render(
      <PayPage vm={buildPayPageVm(ready(), NOW, { ...context, returned: "cancelled" })} />,
    );
    expect(screen.getAllByRole("button", { name: "Try again · £2,375.00" }).length).toBeGreaterThan(
      0,
    );
    // The address is replaced, and the page reads its plan again without the return.
    rerender(<PayPage vm={buildPayPageVm(ready(), NOW, { ...context, returned: null })} />);
    expect(screen.getAllByRole("button", { name: "Try again · £2,375.00" }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Payment not completed");
    // Choosing bank transfer is a different action, worded as usual.
    fireEvent.click(screen.getByRole("radio", { name: "UK bank transfer" }));
    expect(
      screen.getAllByRole("button", { name: "Continue to bank transfer" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows the answer to a new attempt instead of the not-completed note", async () => {
    payAction.mockResolvedValue({ kind: "failed", message: "Paying is paused.", refresh: false });
    draw(ready(), "cancelled");
    fireEvent.click(screen.getAllByRole("button", { name: /Try again/ })[0] as HTMLElement);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Paying is paused."));
    expect(screen.queryByText(/Payment not completed/)).toBeNull();
  });
});

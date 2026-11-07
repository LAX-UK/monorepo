import { buildPayPageVm } from "@/lib/pay/pay-page.vm";
import { LOT_A, LOT_B, NOW, payable, planOf } from "@/lib/pay/pay-plan-fixtures.test-util";
import type { PayPlan } from "@auction/types";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/shell/shell-chrome-context", () => ({ HideBottomTabBarWhileMounted: () => null }));

const payAction = vi.fn();
vi.mock("@/lib/pay/pay.actions", () => ({
  payAction: (...args: unknown[]) => payAction(...args),
}));

import { PayPage } from "./pay-page";

const draw = (plan: PayPlan) =>
  render(<PayPage vm={buildPayPageVm(plan, NOW, "/purchases/pay?lots=a")} imageByLot={{}} />);

const assign = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
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
    expect(within(payment).getByText("Buyer's premium (25%)")).toBeInTheDocument();
    expect(within(payment).getByText("Total to pay")).toBeInTheDocument();
    expect(within(payment).getByText("£2,375.00", { selector: "dd" })).toBeInTheDocument();
    expect(
      within(payment).getByText(/Invoice from London Auction Xchange LTD/),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Lot" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Delivery" })).toBeInTheDocument();
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
    // The button is usable again.
    expect(screen.getAllByRole("button", { name: /Pay £2,375.00/ }).length).toBeGreaterThan(0);
  });

  it("offers the phone bar the same action with the total beside it", () => {
    const { container } = draw(ready());
    const bar = container.querySelector("[data-pay-phone-bar]") as HTMLElement;
    expect(within(bar).getByText("£2,375.00")).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Pay" })).toBeInTheDocument();
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
  ])("never shows a Pay button for %s, and keeps the money visible", (_name, gate) => {
    const { container } = held(gate);
    expect(screen.queryByRole("button", { name: /^Pay/ })).toBeNull();
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
    expect(screen.getByText("One lot in this link isn't in this payment")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Pay £1,250.00/ }).length).toBeGreaterThan(0);
  });
});

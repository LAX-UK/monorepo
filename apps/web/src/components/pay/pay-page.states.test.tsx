import { buildPayPageVm } from "@/lib/pay/pay-page.vm";
import { LOT_A, LOT_B, NOW, payable, planOf } from "@/lib/pay/pay-plan-fixtures.test-util";
import { buildPayProgressVm } from "@/lib/pay/pay-progress.vm";
import type { BankTransferInstructions, PayPlan, PayPlanProgress } from "@auction/types";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));
vi.mock("@/lib/shell/shell-chrome-context", () => ({ HideBottomTabBarWhileMounted: () => null }));
const notifySuccess = vi.fn();
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (...a: unknown[]) => notifySuccess(...a) },
}));

const payAction = vi.fn();
const payProgressAction = vi.fn();
vi.mock("@/lib/pay/pay.actions", () => ({
  payAction: (...args: unknown[]) => payAction(...args),
  payProgressAction: (...args: unknown[]) => payProgressAction(...args),
}));

import { PayPage } from "./pay-page";
import { OPEN_TIMEOUT_MS } from "./pay-session";

const CONTEXT = {
  returnTo: "/purchases/pay?lots=a",
  contactHref: "/contact",
  details: {},
};

const drawReady = (plan: PayPlan, returned: "cancelled" | null = null) =>
  render(<PayPage vm={buildPayPageVm(plan, NOW, { ...CONTEXT, returned })} />);

const small = () => planOf([payable(LOT_A, 190_000, 47_500, { title: "Coastal Notation" })]);
const overCard = () =>
  planOf([
    payable(LOT_A, 800_000, 200_000, { title: "Harbour" }),
    payable(LOT_B, 400_000, 100_000, { title: "Lowland Storm" }),
  ]);

const assign = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign },
  });
});
afterEach(() => vi.useRealTimers());

describe("choosing how to pay (S2)", () => {
  it("offers card and bank transfer as one radio group, card chosen when it is open", () => {
    drawReady(small());
    const group = screen.getByRole("radiogroup", { name: "How you pay" });
    const [card, bank] = within(group).getAllByRole("radio");
    expect(card).toHaveAccessibleName("Card");
    expect(card).toBeChecked();
    expect(bank).toHaveAccessibleName("UK bank transfer");
    expect(bank).not.toBeChecked();
  });

  it("words the action for the chosen method and pays by it", async () => {
    payAction.mockResolvedValue({ kind: "redirect", url: "https://pay.example/1" });
    drawReady(small());
    fireEvent.click(screen.getByRole("radio", { name: "UK bank transfer" }));
    const button = screen.getAllByRole("button", { name: "Continue to bank transfer" })[0];
    expect(button).toBeDefined();
    expect(
      screen.getByText(/We give you our account details and a reference for this payment/),
    ).toBeInTheDocument();
    fireEvent.click(button as HTMLElement);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://pay.example/1"));
    expect(payAction).toHaveBeenCalledExactlyOnceWith({
      lotIds: [LOT_A],
      expectedTotalPence: 237_500,
      method: "bank_transfer",
    });
  });

  it("changes the phone bar with the choice too", () => {
    const { container } = drawReady(small());
    fireEvent.click(screen.getByRole("radio", { name: "UK bank transfer" }));
    const bar = container.querySelector("[data-pay-phone-bar]") as HTMLElement;
    expect(within(bar).getByRole("button", { name: "Continue to bank transfer" })).toBeVisible();
    expect(within(bar).getByText("Continue")).toBeInTheDocument();
  });

  it("shows card as unavailable above the limit with the server's reason, and bank transfer chosen", () => {
    drawReady(overCard());
    const card = screen.getByRole("radio", { name: "Card" });
    expect(card).toBeDisabled();
    expect(card).toHaveAccessibleDescription(
      "Card payments go up to £10,000. Pick fewer invoices to pay by card.",
    );
    expect(screen.getByRole("radio", { name: "UK bank transfer" })).toBeChecked();
    expect(screen.getAllByRole("button", { name: /Continue to bank transfer/ }).length).toBe(2);
  });

  it("remembers the choice for the trip to the payment page and back", () => {
    const first = drawReady(small());
    fireEvent.click(screen.getByRole("radio", { name: "UK bank transfer" }));
    first.unmount();
    drawReady(small());
    expect(screen.getByRole("radio", { name: "UK bank transfer" })).toBeChecked();
  });

  it("does not bring back a remembered card the server no longer allows", () => {
    window.sessionStorage.setItem(`pay-method:${LOT_A},${LOT_B}`, "card");
    drawReady(overCard());
    expect(screen.getByRole("radio", { name: "UK bank transfer" })).toBeChecked();
  });
});

describe("opening the secure payment page (S4)", () => {
  it("tells the person after eight seconds, with a way to try again, and charges nothing", async () => {
    vi.useFakeTimers();
    payAction.mockReturnValue(new Promise(() => undefined));
    drawReady(small());
    fireEvent.click(screen.getAllByRole("button", { name: "Pay £2,375.00" })[0] as HTMLElement);
    expect(
      screen.getAllByRole("button", { name: /Opening secure payment/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(OPEN_TIMEOUT_MS);
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("We couldn't open the secure payment page");
    expect(alert).toHaveTextContent("Nothing was charged. Check your connection and try again.");
    expect(alert.parentElement).toHaveFocus();
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("keeps Try again disabled until the first attempt has answered, so two pages never open", async () => {
    vi.useFakeTimers();
    let answerFirst: (value: unknown) => void = () => undefined;
    payAction.mockReturnValueOnce(
      new Promise((resolve) => {
        answerFirst = resolve;
      }),
    );
    drawReady(small());
    fireEvent.click(screen.getAllByRole("button", { name: "Pay £2,375.00" })[0] as HTMLElement);
    await act(async () => {
      vi.advanceTimersByTime(OPEN_TIMEOUT_MS);
    });
    const retry = within(screen.getByRole("alert")).getByRole("button", { name: "Try again" });
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(payAction).toHaveBeenCalledTimes(1);

    // When the first attempt answers late with a refusal, the notice gives way to the answer.
    await act(async () => {
      answerFirst({ kind: "failed", message: "Paying is paused for a moment.", refresh: false });
      await Promise.resolve();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Paying is paused for a moment.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("goes to the payment page if the first attempt answers after the notice showed", async () => {
    vi.useFakeTimers();
    let answerFirst: (value: unknown) => void = () => undefined;
    payAction.mockReturnValueOnce(
      new Promise((resolve) => {
        answerFirst = resolve;
      }),
    );
    drawReady(small());
    fireEvent.click(screen.getAllByRole("button", { name: "Pay £2,375.00" })[0] as HTMLElement);
    await act(async () => {
      vi.advanceTimersByTime(OPEN_TIMEOUT_MS);
    });
    await act(async () => {
      answerFirst({ kind: "redirect", url: "https://pay.example/first" });
      await Promise.resolve();
    });
    expect(assign).toHaveBeenCalledExactlyOnceWith("https://pay.example/first");
  });
});

describe("coming back without paying (S5)", () => {
  it("announces that nothing was charged, moves focus to the notice, and keeps the form", () => {
    drawReady(small(), "cancelled");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Payment not completed. You were not charged.");
    expect(alert).toHaveTextContent("Try again, use another card, or pay by UK bank transfer.");
    expect(alert.parentElement).toHaveFocus();
    expect(screen.getAllByRole("button", { name: "Try again · £2,375.00" }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("radiogroup", { name: "How you pay" })).toBeInTheDocument();
  });
});

const TRANSFER: BankTransferInstructions = {
  accountName: "London Auction Xchange LTD",
  sortCode: "231470",
  accountNumber: "41926638",
  reference: "LAXB7KQ2R9",
};

function progressOf(over: Partial<PayPlanProgress> = {}): PayPlanProgress {
  return {
    rail: "bank_transfer",
    stage: "awaiting_transfer",
    lots: [
      {
        lotId: LOT_A,
        title: "Harbour",
        lotNumber: 1,
        saleTitle: "Winter sale",
        totalPence: 525_000,
      },
      {
        lotId: LOT_B,
        title: "Lowland Storm",
        lotNumber: 2,
        saleTitle: "Winter sale",
        totalPence: 645_100,
      },
    ],
    totalPence: 1_170_100,
    receivedPence: 0,
    remainingPence: 1_170_100,
    receivedPercent: 0,
    otherInvoices: 0,
    ...over,
  };
}

const drawProgress = (progress: PayPlanProgress, transfer: BankTransferInstructions | null) => {
  const plan = planOf([], {
    progress,
    leftOut: progress.lots.map((l) => ({ lotId: l.lotId, reason: "being_paid" as const })),
  });
  return render(
    <PayPage vm={buildPayProgressVm(plan, progress, { ...CONTEXT, returned: null }, transfer)} />,
  );
};

describe("a bank transfer waiting for its money (S7)", () => {
  it("shows the account details and the reference with a copy button for each", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    drawProgress(progressOf(), TRANSFER);
    const panel = screen.getByRole("region", { name: "Send a UK bank transfer" });
    expect(within(panel).getByText("23-14-70")).toBeInTheDocument();
    expect(within(panel).getByText("41926638")).toBeInTheDocument();
    expect(within(panel).getByText("LAXB7KQ2R9")).toBeInTheDocument();
    expect(within(panel).getByText("£11,701.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pay/ })).toBeNull();

    fireEvent.click(within(panel).getByRole("button", { name: "Copy sort code" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("231470"));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Sort code copied"));
    fireEvent.click(within(panel).getByRole("button", { name: "Copy reference" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("LAXB7KQ2R9"));
    expect(within(panel).queryByRole("button", { name: "Copy amount to send" })).toBeNull();
  });

  it("says where else to find the details, and offers settlements, if they could not be read", () => {
    drawProgress(progressOf(), null);
    const panel = screen.getByRole("region", { name: "Send a UK bank transfer" });
    expect(panel).toHaveTextContent("We couldn't load the bank details just now.");
    expect(within(panel).getByRole("link", { name: "Contact settlements" })).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(within(panel).queryByText("23-14-70")).toBeNull();
  });
});

describe("a bank transfer that arrived in part (S8)", () => {
  it("says what is received and left, with a labelled bar, and still shows the details", () => {
    drawProgress(
      progressOf({
        stage: "part_received",
        receivedPence: 600_000,
        remainingPence: 570_100,
        receivedPercent: 51,
      }),
      TRANSFER,
    );
    expect(screen.getByRole("status")).toHaveTextContent("£6,000.00 of £11,701.00 received");
    expect(screen.getByRole("status")).toHaveTextContent("Send the remaining £5,701.00");
    const bar = screen.getByRole("meter", { name: "£6,000.00 of £11,701.00 received" });
    expect(bar).toHaveAttribute("aria-valuenow", "51");
    expect(screen.getByText("51% received · Reference LAXB7KQ2R9")).toBeInTheDocument();
    expect(screen.getByText("£5,701.00", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Send a UK bank transfer" })).toBeInTheDocument();
  });
});

describe("confirming a card payment (S6)", () => {
  const confirming = () =>
    progressOf({
      rail: "card",
      stage: "confirming",
      lots: [
        {
          lotId: LOT_A,
          title: "Coastal Notation",
          lotNumber: 1,
          saleTitle: null,
          totalPence: 237_500,
        },
      ],
      totalPence: 237_500,
      remainingPence: 237_500,
    });

  beforeEach(() => vi.useFakeTimers());

  it("says it is confirming, and that the page updates by itself", () => {
    payProgressAction.mockResolvedValue("confirming:0");
    drawProgress(confirming(), null);
    expect(screen.getByRole("status")).toHaveTextContent("Confirming your payment");
    expect(screen.getByRole("status")).toHaveTextContent("this page updates by itself");
    expect(screen.queryByRole("button", { name: /Pay|Continue/ })).toBeNull();
  });

  it("asks the server again and again, and reads the page again as soon as the answer changes", async () => {
    payProgressAction
      .mockResolvedValueOnce("confirming:0")
      .mockResolvedValueOnce("confirming:0")
      .mockResolvedValueOnce("none");
    drawProgress(confirming(), null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(payProgressAction).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(payProgressAction).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(payProgressAction).toHaveBeenCalledTimes(3);
    expect(payProgressAction).toHaveBeenCalledWith([LOT_A]);
    expect(refresh).toHaveBeenCalledTimes(1);
    // It stops asking once the payment has moved.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(payProgressAction).toHaveBeenCalledTimes(3);
  });

  it("after three minutes says it is still confirming, with Refresh and settlements", async () => {
    payProgressAction.mockResolvedValue("confirming:0");
    drawProgress(confirming(), null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(181_000);
    });
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Still confirming");
    expect(notice).toHaveTextContent("Please don't pay again.");
    fireEvent.click(within(notice).getByRole("button", { name: "Refresh" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(within(notice).getByRole("link", { name: "Contact settlements" })).toBeInTheDocument();
    const callsAtStop = payProgressAction.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(payProgressAction).toHaveBeenCalledTimes(callsAtStop);
  });

  it("keeps waiting when the server cannot be read, without refreshing", async () => {
    payProgressAction.mockResolvedValue(null);
    drawProgress(confirming(), null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(payProgressAction).toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not ask while the tab is hidden", async () => {
    payProgressAction.mockResolvedValue("none");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    drawProgress(confirming(), null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(payProgressAction).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });
});

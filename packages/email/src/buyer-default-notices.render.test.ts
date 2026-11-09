import { describe, expect, it } from "vitest";
import {
  BUYER_DEFAULT_NO_CHARGES,
  buyerDefaultCopy,
  paymentReminderCopy,
} from "./buyer-default-copy.js";
import { renderEmail } from "./render.js";

const base = {
  userName: "Maya",
  lotTitle: "Harbour at dusk",
  supportContactEmail: "support@lax.bid",
};

describe("payment-reminder", () => {
  it.each([
    ["before_due", "Payment due soon: Harbour at dusk", "is due on 10 November 2026"],
    ["due_day", "Payment due today: Harbour at dusk", "is due today"],
    ["overdue", "Payment overdue: Harbour at dusk", "was due on 10 November 2026"],
  ] as const)("says the right thing at step %s", async (step, subject, line) => {
    const email = await renderEmail("payment-reminder", {
      ...base,
      step,
      amount: "£1,200.00",
      dueDate: "10 November 2026",
      payUrl: "https://lax.bid/purchases/checkout/lot-1",
    });
    expect(email.subject).toBe(subject);
    expect(email.text).toContain(line);
    expect(email.text).toContain("£1,200.00");
    expect(email.html).toContain("https://lax.bid/purchases/checkout/lot-1");
  });

  it("calls the item a lot on a lot's reminder and a work on a private sale's", async () => {
    const vars = {
      ...base,
      step: "due_day" as const,
      amount: "£1,200.00",
      dueDate: "10 November 2026",
      payUrl: "https://lax.bid/purchases",
    };
    const lot = await renderEmail("payment-reminder", vars);
    expect(lot.html).toMatch(/>Lot</);
    const deal = await renderEmail("payment-reminder", { ...vars, itemLabel: "Work" });
    expect(deal.html).toMatch(/>Work</);
    expect(deal.html).not.toMatch(/>Lot</);
    expect(deal.text).not.toMatch(/\blot\b/i);
    expect(deal.text).toContain("Harbour at dusk");
  });

  it("a held invoice asks the buyer to verify their identity, with that link instead of Pay now", async () => {
    const email = await renderEmail("payment-reminder", {
      ...base,
      step: "due_day",
      amount: "£1,200.00",
      dueDate: "10 November 2026",
      payUrl: "https://lax.bid/purchases/checkout/lot-1",
      held: "identity_verification_required",
      actionUrl: "https://lax.bid/verify-identity",
    });
    expect(email.subject).toBe("Verify your identity to pay for Harbour at dusk");
    expect(email.html).toContain("https://lax.bid/verify-identity");
    expect(email.text).not.toContain("Pay now");
  });

  it("an organisation under review is told it cannot pay yet, with no payment button", async () => {
    const email = await renderEmail("payment-reminder", {
      ...base,
      step: "overdue",
      amount: "£1,200.00",
      dueDate: "10 November 2026",
      payUrl: "https://lax.bid/purchases/checkout/lot-1",
      held: "organisation_under_review",
    });
    expect(email.text).toContain("cannot be paid yet");
    expect(email.text).not.toContain("Pay now");
  });

  it("uses the same words in the app as in the email", () => {
    const copy = paymentReminderCopy("due_day", {
      lotTitle: "Harbour at dusk",
      amount: "£1,200.00",
      dueDate: "10 November 2026",
    });
    expect(copy.paragraphs[0]).toBe("Payment of £1,200.00 for Harbour at dusk is due today.");
  });
});

describe("buyer-default-notice", () => {
  const input = (audience: "buyer" | "seller" | "underbidder") => ({
    ...base,
    audience,
    amount: "£1,200.00",
    outcome: "returned_to_inventory" as const,
    buyerRestricted: false,
    actionUrl: "https://lax.bid/purchases",
    actionLabel: "View your purchases",
  });

  it("tells the buyer the sale is cancelled and that nothing more is owed or charged", async () => {
    const email = await renderEmail("buyer-default-notice", input("buyer"));
    expect(email.subject).toBe("Your purchase was cancelled: Harbour at dusk");
    expect(email.text).toContain("You do not owe anything further");
    expect(email.text).toContain(BUYER_DEFAULT_NO_CHARGES);
  });

  it("tells the buyer when bidding is paused", () => {
    const copy = buyerDefaultCopy("buyer", { ...input("buyer"), buyerRestricted: true });
    expect(copy.paragraphs.join(" ")).toContain("Bidding on your account is paused");
  });

  it("tells the seller they will be asked before the lot is offered again", async () => {
    const email = await renderEmail("buyer-default-notice", input("seller"));
    expect(email.text).toContain("we will ask you before it is offered again");
  });

  it("tells the seller we will ask for agreement before an offer to the next bidder", () => {
    const copy = buyerDefaultCopy("seller", {
      ...input("seller"),
      outcome: "offered_to_underbidder",
    });
    expect(copy.paragraphs.join(" ")).toContain("We will ask for your agreement");
  });

  it("tells the next bidder nothing is expected of them yet", async () => {
    const email = await renderEmail("buyer-default-notice", input("underbidder"));
    expect(email.subject).toBe("Harbour at dusk may become available");
    expect(email.text).toContain("you are not committed to buy");
  });
});

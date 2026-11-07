import type { PayPlan, PayPlanGate } from "@auction/types";
import { describe, expect, it } from "vitest";
import { type PayLotDetails, type PayPageVm, buildPayPageVm } from "./pay-page.vm";
import { LOT_A, LOT_B, LOT_C, NOW, payable, planOf } from "./pay-plan-fixtures.test-util";

const RETURN_TO = "/purchases/pay?lots=a";
const CONTACT = "mailto:settlements@lax.bid";
const build = (
  plan: PayPlan,
  extra: { returned?: "cancelled" | null; details?: Record<string, PayLotDetails> } = {},
): PayPageVm =>
  buildPayPageVm(plan, NOW, {
    returnTo: RETURN_TO,
    contactHref: CONTACT,
    returned: extra.returned ?? null,
    details: extra.details ?? {},
  });

const one = () => planOf([payable(LOT_A, 190_000, 47_500, { title: "Coastal Notation" })]);

describe("one lot, ready to pay", () => {
  const vm = build(one());

  it("names the work, the lot and the sale, with the day it is due", () => {
    expect(vm.state).toBe("ready");
    expect(vm.title).toBe("Pay for Coastal Notation");
    expect(vm.subtitle).toBe("Lot 12 · Winter sale");
    expect(vm.badge).toEqual({ label: "Due Fri 13 Nov", tone: "warning", shape: "dot" });
    expect(vm.money?.due).toBe("Due by Fri 13 Nov");
  });

  it("says the lot's reference, due day and total once: in the title row and the payment panel", () => {
    expect(vm.lots[0]?.detail).toBeNull();
    expect(vm.back).toEqual({ label: "Back to purchase", href: `/purchases/${LOT_A}` });
  });

  it("adds the day it was won, and who won it for an organisation", () => {
    const details = {
      [LOT_A]: { image: null, wonAt: new Date("2026-10-30T14:00:00Z"), wonBy: "Ada Lovelace" },
    };
    expect(build(one(), { details }).subtitle).toBe("Lot 12 · Winter sale · Won Fri 30 Oct");
    const org = planOf([payable(LOT_A, 190_000, 47_500, { title: "Coastal Notation" })], {
      account: { legalEntityId: "le-2", kind: "organisation", name: "Northbank Gallery" },
    });
    expect(build(org, { details }).subtitle).toBe(
      "Lot 12 · Winter sale · Won Fri 30 Oct · Won by Ada Lovelace for Northbank Gallery",
    );
  });

  it("shows the invoice's own lines and the server's total", () => {
    expect(vm.money?.lines).toEqual([
      { label: "Hammer price", amount: "£1,900.00" },
      { label: "Buyer's premium (25%)", amount: "£475.00" },
    ]);
    expect(vm.money?.totalLabel).toBe("Total to pay");
    expect(vm.money?.total).toBe("£2,375.00");
  });

  it("names the company that issues the invoice, and numbers only once they exist", () => {
    expect(vm.money?.company).toBe(
      "Invoice from London Auction Xchange LTD, 156 New Cavendish Street, London W1W 6YW",
    );
    expect(vm.money?.registration).toEqual([]);
    const registered = build(
      planOf([payable(LOT_A, 100, 25)], {
        entity: {
          name: "London Auction Xchange LTD",
          address: "156 New Cavendish Street, London W1W 6YW",
          companyNumber: "12345678",
          vatNumber: "GB123456789",
        },
      }),
    );
    expect(registered.money?.registration).toEqual([
      "Company number 12345678",
      "VAT number GB123456789",
    ]);
  });

  it("offers Pay for exactly the lots and total whole pence that were shown", () => {
    expect(vm.action).toEqual({
      kind: "pay",
      label: "Pay £2,375.00",
      barLabel: "Pay",
      lotIds: [LOT_A],
      expectedTotalPence: 237_500,
    });
    expect(vm.howYouPay).toEqual([
      "Card: Visa, Mastercard, Amex. Your bank may ask you to confirm.",
    ]);
    expect(vm.actionNote).toMatch(/Nothing is charged until you confirm there/);
  });
});

describe("the page does no money arithmetic", () => {
  it("shows the server's total even when it disagrees with the parts", () => {
    // A plan whose total is not the sum of its lots is the server's to explain; the page does
    // not repair it. The figure that would be charged is the one sent with the pay request.
    const plan = planOf([payable(LOT_A, 100_000, 25_000)]);
    const odd: PayPlan = { ...plan, totals: { ...plan.totals, pence: 999_999 } };
    const vm = build(odd);
    expect(vm.money?.total).toBe("£9,999.99");
    expect(vm.action).toMatchObject({ kind: "pay", expectedTotalPence: 999_999 });
  });

  it("sums nothing for several lots: each kind is the server's figure", () => {
    const plan = planOf([payable(LOT_A, 100_000, 25_000), payable(LOT_B, 200_000, 50_000)]);
    const withKinds: PayPlan = {
      ...plan,
      totals: {
        pence: plan.totals.pence,
        byKind: [
          { kind: "hammer", pence: 311_111 },
          { kind: "buyers_premium", pence: 77_777 },
        ],
      },
    };
    expect(build(withKinds).money?.lines).toEqual([
      { label: "Hammer price", amount: "£3,111.11" },
      { label: "Buyer's premium", amount: "£777.77" },
    ]);
  });
});

describe("several lots, one payment", () => {
  const plan = planOf([
    payable(LOT_A, 100_000, 25_000, { dueAt: "2026-11-13T23:59:59Z" }),
    payable(LOT_B, 200_000, 50_000, { dueAt: "2026-11-11T23:59:59Z" }),
  ]);
  const vm = build(plan);

  it("titles the payment by its invoices and dates it by the first due", () => {
    expect(vm.title).toBe("Pay 2 invoices");
    expect(vm.subtitle).toBe("One payment for 2 lots you won");
    expect(vm.back).toEqual({ label: "Back to purchases", href: "/purchases" });
    expect(vm.lots[0]?.detail).toEqual({
      subtitle: "Lot 12 · Winter sale",
      due: "Due by Fri 13 Nov",
      total: "£1,250.00",
    });
    expect(vm.badge?.label).toBe("First due Wed 11 Nov");
    expect(vm.money?.due).toBe("Due by Wed 11 Nov");
  });

  it("sums the lines per kind as the server sent them", () => {
    expect(vm.money?.lines).toEqual([
      { label: "Hammer price", amount: "£3,000.00" },
      { label: "Buyer's premium", amount: "£750.00" },
    ]);
    expect(vm.money?.total).toBe("£3,750.00");
  });
});

describe("how the total is paid", () => {
  it("goes to bank transfer above the card limit, and says card is limited", () => {
    const vm = build(planOf([payable(LOT_A, 1_000_000, 250_000)]));
    expect(vm.action).toMatchObject({
      kind: "pay",
      label: "Continue to bank transfer",
      barLabel: "Continue",
    });
    expect(vm.howYouPay.join(" ")).toMatch(/UK bank transfer/);
    expect(vm.howYouPay.join(" ")).toMatch(/Card payments have a limit/);
  });

  it("offers no way to pay a total no online method takes, and says so", () => {
    const plan = planOf([payable(LOT_A, 100_000, 25_000)]);
    const vm = build({
      ...plan,
      methods: [
        { method: "card", available: false, reason: "over_online_limit" },
        { method: "bank_transfer", available: false, reason: "over_online_limit" },
      ],
    });
    expect(vm.action).toBeNull();
    expect(vm.notices[0]?.title).toMatch(/more than one online payment can take/);
  });

  it("names the organisation on the button when paying for one", () => {
    const vm = build(
      planOf([payable(LOT_A, 100_000, 25_000)], {
        account: { legalEntityId: "le-2", kind: "organisation", name: "Northbank Gallery" },
      }),
    );
    expect(vm.action).toMatchObject({ label: "Pay £1,250.00 for Northbank Gallery" });
    expect(vm.subtitle).toBe("Lot 12 · Winter sale · Paying for Northbank Gallery");
  });
});

describe("an overdue invoice", () => {
  it("says since when, without consequences, and keeps Pay", () => {
    const vm = build(
      planOf([payable(LOT_A, 100_000, 25_000, { overdue: true, dueAt: "2026-11-04T23:59:59Z" })]),
    );
    expect(vm.badge).toEqual({ label: "Overdue since Wed 4 Nov", tone: "danger", shape: "alert" });
    expect(vm.money?.due).toBe("Was due Wed 4 Nov");
    expect(vm.action?.kind).toBe("pay");
    expect(vm.notices[0]).toEqual({
      tone: "danger",
      title: "Payment was due on Wed 4 Nov. Please pay now.",
      detail: "If something is stopping you, contact settlements and we'll help.",
      action: { label: "Contact settlements", href: CONTACT },
    });
    expect(JSON.stringify(vm)).not.toMatch(/fee|penalt|interest|legal/i);
  });
});

/** Every check that can stop a payment. A held payment never shows Pay. */
const HELD_GATES: { name: string; gate: PayPlanGate; title: RegExp; actionLabel: string | null }[] =
  [
    {
      name: "identity not verified",
      gate: { kind: "held", reason: "identity_verification_required" },
      title: /Verify your identity to pay/,
      actionLabel: "Verify identity",
    },
    {
      name: "source of funds for the payer",
      gate: { kind: "compliance", reason: "source_of_funds_required", subject: "payer" },
      title: /confirm the source of funds before you pay/,
      actionLabel: "Provide documents",
    },
    {
      name: "source of funds for the winner",
      gate: { kind: "compliance", reason: "source_of_funds_required", subject: "winner" },
      title: /checking a few details/,
      actionLabel: null,
    },
    {
      name: "anti-money-laundering hold on the payer",
      gate: { kind: "compliance", reason: "aml_hold", subject: "payer" },
      title: /checking a few details before you can pay/,
      actionLabel: null,
    },
    {
      name: "anti-money-laundering hold on the winner",
      gate: { kind: "compliance", reason: "aml_hold", subject: "winner" },
      title: /checking a few details/,
      actionLabel: null,
    },
    {
      name: "finance check at £500,000 and above",
      gate: { kind: "finance_check" },
      title: /finance team sets up payments of this size/,
      actionLabel: null,
    },
    {
      name: "organisation under review",
      gate: { kind: "held", reason: "organisation_under_review" },
      title: /still checking your organisation/,
      actionLabel: null,
    },
    {
      name: "organisation closed",
      gate: { kind: "refused", reason: "organisation_closed" },
      title: /can't make payments/,
      actionLabel: "Contact client services",
    },
    {
      name: "account not set up",
      gate: { kind: "onboarding_required" },
      title: /Finish setting up your account/,
      actionLabel: "Finish setting up",
    },
  ];

describe.each(HELD_GATES)("held: $name", ({ gate, title, actionLabel }) => {
  const vm = build(planOf([payable(LOT_A, 190_000, 47_500)], { gate }));

  it("keeps the money visible and never offers Pay", () => {
    expect(vm.state).toBe("held");
    expect(vm.money?.total).toBe("£2,375.00");
    expect(vm.action?.kind).not.toBe("pay");
    expect(vm.howYouPay).toEqual([]);
    expect(vm.actionNote).toBeNull();
  });

  it("says what is in the way and the next step", () => {
    expect(vm.notices[0]?.title).toMatch(title);
    expect(vm.notices[0]?.action?.label ?? null).toBe(actionLabel);
    expect(vm.action?.kind === "link" ? vm.action.label : null).toBe(actionLabel);
  });
});

describe("held: where the next step leads", () => {
  it("sends identity to the check and back to this page afterwards", () => {
    const vm = build(
      planOf([payable(LOT_A, 100, 25)], {
        gate: { kind: "held", reason: "identity_verification_required" },
      }),
    );
    expect(vm.action).toEqual({
      kind: "link",
      label: "Verify identity",
      href: `/verify-identity?next=${encodeURIComponent(RETURN_TO)}`,
    });
  });

  it("sends source of funds to the documents page", () => {
    const vm = build(
      planOf([payable(LOT_A, 100, 25)], {
        gate: { kind: "compliance", reason: "source_of_funds_required", subject: "payer" },
      }),
    );
    expect(vm.action).toEqual({
      kind: "link",
      label: "Provide documents",
      href: "/compliance/source-of-funds",
    });
  });

  it("does not send a payer to upload documents for a check on the person who won", () => {
    const vm = build(
      planOf([payable(LOT_A, 100, 25)], {
        gate: { kind: "compliance", reason: "source_of_funds_required", subject: "winner" },
      }),
    );
    expect(vm.action).toBeNull();
  });
});

describe("a buyer agent who does not pay", () => {
  const vm = build(
    planOf([payable(LOT_A, 100_000, 25_000)], {
      payerRole: "informed",
      gate: { kind: "not_payer", payingAccountName: "Northbank Gallery" },
    }),
  );

  it("is told who pays, sees the money and gets no action", () => {
    expect(vm.state).toBe("informed");
    expect(vm.notices[0]?.title).toBe("Northbank Gallery pays for this lot");
    expect(vm.money?.total).toBe("£1,250.00");
    expect(vm.action).toBeNull();
    expect(vm.badge?.label).toBe("Awaiting payment");
  });
});

describe("lots left out of the payment", () => {
  it("pays the rest and says what was left out", () => {
    const vm = build(
      planOf([payable(LOT_A, 100_000, 25_000)], {
        leftOut: [{ lotId: LOT_B, reason: "other_account" }],
      }),
    );
    expect(vm.state).toBe("ready");
    expect(vm.action?.kind).toBe("pay");
    expect(vm.notices).toEqual([
      {
        tone: "info",
        title: "One lot in this link isn't yours to pay",
        detail:
          "It was won for another account, or it's already paid. We've left it out; the rest are below.",
      },
    ]);
  });

  it("counts left-out lots by reason", () => {
    const vm = build(
      planOf([payable(LOT_A, 100_000, 25_000)], {
        leftOut: [
          { lotId: LOT_B, reason: "held_for_review" },
          { lotId: LOT_C, reason: "paid" },
          { lotId: "x", reason: "paid" },
        ],
      }),
    );
    expect(vm.notices[0]?.title).toBe("3 lots in this link aren't in this payment");
    expect(vm.notices[0]?.detail).toBe(
      "1 is in review and can be paid once we have checked it. 2 are already paid. The rest are below.",
    );
  });
});

describe("nothing in the link can be paid", () => {
  const none = (reasons: PayPlan["leftOut"], overrides: Partial<PayPlan> = {}) =>
    build(planOf([], { leftOut: reasons, ...overrides }));

  it("says the payment is being confirmed, and not to pay again", () => {
    const vm = none([{ lotId: LOT_A, reason: "being_confirmed" }]);
    expect(vm.state).toBe("confirming");
    expect(vm.badge?.label).toBe("Confirming payment");
    expect(vm.notices[0]?.title).toBe("Confirming your payment");
    expect(vm.notices[0]?.detail).toMatch(/Please don't pay again/);
    expect(vm.notices[0]?.action).toEqual({ label: "Refresh", href: RETURN_TO });
    expect(vm.action).toBeNull();
  });

  it("treats a payment already in another group as being paid", () => {
    const open = none([{ lotId: LOT_A, reason: "being_paid" }]);
    expect(open.state).toBe("confirming");
    expect(open.notices[0]?.title).toBe("A payment for this is already open");
    expect(open.notices[0]?.detail).toBe(
      "Finish it on the secure payment page, or try again later.",
    );
    expect(JSON.stringify(open)).not.toMatch(/Confirming your payment/);
  });

  it("holds when every lot waits on a review, with no way to pay", () => {
    const vm = none([{ lotId: LOT_A, reason: "held_for_review" }]);
    expect(vm.state).toBe("held");
    expect(vm.action).toBeNull();
    expect(vm.notices[0]?.title).toBe("Our team is checking this invoice");
  });

  it("explains a role that does not pay", () => {
    const vm = none([{ lotId: LOT_A, reason: "not_payer" }]);
    expect(vm.state).toBe("informed");
    expect(vm.action).toBeNull();
  });

  it("says every invoice is paid when they all are", () => {
    const vm = none([
      { lotId: LOT_A, reason: "paid" },
      { lotId: LOT_B, reason: "paid" },
    ]);
    expect(vm.state).toBe("empty");
    expect(vm.empty?.title).toBe("Nothing to pay");
    expect(vm.empty?.description).toMatch(/Every invoice is paid/);
    expect(vm.empty?.action).toEqual({ label: "Open purchases", href: "/purchases" });
  });

  it("says none of them can be paid from this account otherwise", () => {
    const vm = none([
      { lotId: LOT_A, reason: "other_account" },
      { lotId: LOT_B, reason: "cancelled" },
    ]);
    expect(vm.state).toBe("empty");
    expect(vm.empty?.description).toMatch(/can be paid from this account/);
  });

  it("is empty with no lots at all", () => {
    expect(none([]).state).toBe("empty");
    expect(none([]).title).toBe("Pay");
  });
});

describe("nothing to pay: why", () => {
  const empty = (reason: PayPlan["leftOut"][number]["reason"]) =>
    build(planOf([], { leftOut: [{ lotId: LOT_A, reason }] })).empty?.description ?? "";

  it("gives cancelled, voided and refunded lots their own accurate words", () => {
    expect(empty("cancelled")).toMatch(/did not go ahead/);
    expect(empty("voided")).toMatch(/invoice for these lots was cancelled/);
    expect(empty("refunded")).toMatch(/were refunded/);
    expect(empty("cancelled")).not.toMatch(/another account/);
  });
});

describe("a return from the payment page", () => {
  it("says a payment that was not completed charged nothing, above everything else", () => {
    const vm = build(one(), { returned: "cancelled" });
    expect(vm.notices[0]).toEqual({
      tone: "danger",
      title: "Payment not completed",
      detail:
        "Nothing was charged. Your bank's check may not have finished, or the card was declined. You can try again.",
    });
    expect(vm.action?.kind).toBe("pay");
  });

  it("says it on a page with nothing to pay too", () => {
    const vm = build(planOf([], { leftOut: [{ lotId: LOT_A, reason: "paid" }] }), {
      returned: "cancelled",
    });
    expect(vm.notices[0]?.title).toBe("Payment not completed");
  });
});

describe("identity: the rail shows Pay disabled, with why", () => {
  it("offers a disabled Pay on desktop and the step that clears it", () => {
    const vm = build(
      planOf([payable(LOT_A, 190_000, 47_500)], {
        gate: { kind: "held", reason: "identity_verification_required" },
      }),
    );
    expect(vm.railPay).toEqual({ label: "Pay £2,375.00", reason: "Verify your identity to pay" });
    expect(vm.action?.kind).toBe("link");
  });

  it("shows no disabled Pay for any other check", () => {
    const vm = build(
      planOf([payable(LOT_A, 190_000, 47_500)], { gate: { kind: "finance_check" } }),
    );
    expect(vm.railPay).toBeNull();
  });
});

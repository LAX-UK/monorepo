import type { InvoiceLine, PayPlan, PayPlanPayable } from "@auction/types";

export const LOT_A = "11111111-1111-4111-8111-111111111111";
export const LOT_B = "22222222-2222-4222-8222-222222222222";
export const LOT_C = "33333333-3333-4333-8333-333333333333";

/** 2026-11-06 12:00 UTC: a Friday, before the due dates the fixtures use. */
export const NOW = new Date("2026-11-06T12:00:00Z");

export function hammerAndPremium(hammerPence: number, premiumPence: number): InvoiceLine[] {
  return [
    { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: hammerPence },
    {
      kind: "buyers_premium",
      label: "Buyer's premium (25%)",
      ratePercent: "25",
      amountPence: premiumPence,
    },
  ];
}

export function payable(
  lotId: string,
  hammerPence: number,
  premiumPence: number,
  overrides: Partial<PayPlanPayable> = {},
): PayPlanPayable {
  return {
    lotId,
    paymentId: `pay-${lotId.slice(0, 4)}`,
    invoiceId: `inv-${lotId.slice(0, 4)}`,
    title: `Lot ${lotId.slice(0, 4)}`,
    lotNumber: 12,
    saleTitle: "Winter sale",
    lines: hammerAndPremium(hammerPence, premiumPence),
    totalPence: hammerPence + premiumPence,
    dueAt: "2026-11-13T23:59:59Z",
    overdue: false,
    ...overrides,
  };
}

/** A plan for the given invoices; the totals are what the server would send for them. */
export function planOf(payables: PayPlanPayable[], overrides: Partial<PayPlan> = {}): PayPlan {
  const totalPence = payables.reduce((sum, p) => sum + p.totalPence, 0);
  const byKind = new Map<InvoiceLine["kind"], number>();
  for (const p of payables) {
    for (const line of p.lines)
      byKind.set(line.kind, (byKind.get(line.kind) ?? 0) + line.amountPence);
  }
  const dues = payables.map((p) => Date.parse(p.dueAt));
  return {
    account: { legalEntityId: "le-1", kind: "individual", name: "Mahmoud" },
    payerRole: "payer",
    entity: {
      name: "London Auction Xchange LTD",
      address: "156 New Cavendish Street, London W1W 6YW",
      companyNumber: null,
      vatNumber: null,
    },
    gate: { kind: "clear" },
    payable: payables,
    leftOut: [],
    totals: {
      pence: totalPence,
      byKind: [...byKind].map(([kind, pence]) => ({ kind, pence })),
    },
    firstDueAt: dues.length > 0 ? new Date(Math.min(...dues)).toISOString() : null,
    methods: [
      {
        method: "card",
        available: totalPence <= 1_000_000,
        reason: totalPence <= 1_000_000 ? null : "over_card_limit",
      },
      { method: "bank_transfer", available: true, reason: null },
    ],
    cardLimitPence: 1_000_000,
    progress: null,
    currency: "GBP",
    ...overrides,
  };
}

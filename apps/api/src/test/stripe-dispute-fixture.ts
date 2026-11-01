import type Stripe from "stripe";

/** A `charge.dispute.created` payload in Stripe's shape (API 2025+), trimmed to what Bid reads. */
export const STRIPE_DISPUTE_FIXTURE = {
  id: "dp_1QfixtureAbc",
  object: "dispute",
  amount: 500_000,
  balance_transactions: [],
  charge: "ch_fixture",
  created: 1_798_000_000,
  currency: "gbp",
  evidence_details: {
    due_by: 1_798_950_000,
    has_evidence: false,
    past_due: false,
    submission_count: 0,
  },
  is_charge_refundable: true,
  livemode: false,
  metadata: {},
  network_reason_code: "10.4",
  payment_intent: "pi_fixture",
  payment_method_details: {
    card: { brand: "visa", case_type: "chargeback", network_reason_code: "10.4" },
    type: "card",
  },
  reason: "fraudulent",
  status: "needs_response",
} as unknown as Stripe.Dispute;

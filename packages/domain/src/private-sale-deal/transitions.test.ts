import type { PrivateSaleDealStage } from "@auction/types";
import { describe, expect, it } from "vitest";
import { describeDealBlocker } from "./blockers.js";
import { BUYER, CLEAR_SNAPSHOT, NOW, POLICY, context, deal } from "./deal-fixtures.test-util.js";
import { resolvePrivateSalePolicy } from "./policy.js";
import {
  DEAL_TRANSITIONS,
  type DealCommand,
  dealBlockers,
  dealCommandsFrom,
  transitionDeal,
} from "./transitions.js";

const codes = (blockers: { code: string; party?: string }[]) =>
  blockers.map((b) => (b.party ? `${b.code}:${b.party}` : b.code));

const agreedDeal = (over = {}) =>
  deal({
    stage: "agreed",
    buyer: BUYER,
    priceMinor: 4_800_000,
    agreedAt: NOW,
    agreedByUserId: "u-agreer",
    ...over,
  });

describe("deal stages", () => {
  it("moves through every stage in order", () => {
    let current = deal({ buyer: BUYER, priceMinor: 4_800_000 });
    const steps: [DealCommand, PrivateSaleDealStage, object?][] = [
      ["open_offer", "offer"],
      ["agree", "agreed"],
      ["clear", "cleared"],
      ["issue_invoice", "invoiced", { actorUserId: "u-finance" }],
      ["mark_paid", "paid"],
      ["release", "released"],
      ["settle", "settled"],
    ];
    for (const [command, to, ctx] of steps) {
      const result = transitionDeal(
        { ...current, vatTreatment: "margin_scheme", sellerCommissionBps: 1500 },
        command,
        context({
          clearance: { ...CLEAR_SNAPSHOT, buyerSourceOfFunds: "approved" },
          ...(command === "agree" ? { actorUserId: "u-agreer" } : {}),
          ...(ctx ?? {}),
        }),
      );
      expect(result.ok, `${command}: ${JSON.stringify(result)}`).toBe(true);
      if (!result.ok) return;
      expect(result.change.from).toBe(current.stage);
      expect(result.change.to).toBe(to);
      current = {
        ...current,
        stage: to,
        agreedByUserId: command === "agree" ? "u-agreer" : current.agreedByUserId,
      };
    }
    expect(dealCommandsFrom("settled")).toEqual([]);
  });

  it("allows each move only from its own stage", () => {
    const stages: PrivateSaleDealStage[] = [
      "proposed",
      "offer",
      "agreed",
      "cleared",
      "invoiced",
      "paid",
      "released",
      "settled",
      "cancelled",
    ];
    for (const [command, row] of Object.entries(DEAL_TRANSITIONS) as [
      DealCommand,
      (typeof DEAL_TRANSITIONS)[DealCommand],
    ][]) {
      for (const stage of stages.filter((s) => !row.from.includes(s))) {
        expect(
          codes(
            dealBlockers(
              deal({ stage, buyer: BUYER, priceMinor: 100 }),
              command,
              context({ cancelReason: "x", refundRecorded: true }),
            ),
          ),
          `${command} from ${stage}`,
        ).toEqual(["invalid_transition"]);
      }
    }
  });

  it("offers no move once a deal is settled or cancelled", () => {
    expect(dealCommandsFrom("settled")).toEqual([]);
    expect(dealCommandsFrom("cancelled")).toEqual([]);
    expect(dealCommandsFrom("proposed")).toEqual(["open_offer", "cancel"]);
  });
});

describe("open offer", () => {
  it("needs a named buyer", () => {
    expect(codes(dealBlockers(deal(), "open_offer", context()))).toEqual(["buyer_not_named"]);
  });
});

describe("agree: identity and screening gate", () => {
  const offer = (over = {}) =>
    deal({
      stage: "offer",
      buyer: BUYER,
      priceMinor: 4_800_000,
      sellerCommissionBps: 1500,
      ...over,
    });

  it("is allowed when both parties are clear and have accepted the terms", () => {
    const result = transitionDeal(offer(), "agree", context());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.change.changes).toEqual({ agreedAt: NOW, agreedByUserId: "u-staff" });
    }
  });

  it.each([
    ["seller", "pending", "kyc_not_clear:seller"],
    ["buyer", "failed", "kyc_not_clear:buyer"],
  ] as const)("is blocked while the %s's identity is %s", (party, kyc, expected) => {
    const clearance = { ...CLEAR_SNAPSHOT, [party]: { kyc, aml: "clear" } };
    expect(codes(dealBlockers(offer(), "agree", context({ clearance })))).toEqual([expected]);
  });

  it.each(["pending", "review", "blocked"] as const)(
    "is blocked while the buyer's AML screening is %s",
    (aml) => {
      const clearance = { ...CLEAR_SNAPSHOT, buyer: { kyc: "clear" as const, aml } };
      expect(codes(dealBlockers(offer(), "agree", context({ clearance })))).toEqual([
        "aml_not_clear:buyer",
      ]);
    },
  );

  it("reports every party and check that is not clear", () => {
    const clearance = {
      ...CLEAR_SNAPSHOT,
      seller: { kyc: "pending" as const, aml: "review" as const },
      buyer: { kyc: "pending" as const, aml: "pending" as const },
    };
    expect(codes(dealBlockers(offer(), "agree", context({ clearance })))).toEqual([
      "kyc_not_clear:seller",
      "aml_not_clear:seller",
      "kyc_not_clear:buyer",
      "aml_not_clear:buyer",
    ]);
  });

  it("is blocked when a party has no account", () => {
    const clearance = { ...CLEAR_SNAPSHOT, seller: null };
    expect(codes(dealBlockers(offer(), "agree", context({ clearance })))).toEqual([
      "party_missing:seller",
    ]);
  });

  it("needs an agreed price", () => {
    expect(codes(dealBlockers(offer({ priceMinor: null }), "agree", context()))).toEqual([
      "price_not_set",
    ]);
  });

  it("needs the buyer to be named", () => {
    const blockers = codes(dealBlockers(offer({ buyer: null }), "agree", context()));
    expect(blockers).toContain("buyer_not_named");
    expect(blockers).not.toContain("party_missing:buyer");
  });

  it("waits for the private sale terms to be configured", () => {
    const policy = resolvePrivateSalePolicy({ ...POLICY, termsVersion: null });
    expect(codes(dealBlockers(offer(), "agree", context({ policy })))).toEqual([
      "terms_version_not_configured",
    ]);
  });

  it("needs both sides to have accepted the terms", () => {
    expect(
      codes(
        dealBlockers(
          offer(),
          "agree",
          context({ termsAcceptance: { seller: true, buyer: false } }),
        ),
      ),
    ).toEqual(["terms_not_accepted:buyer"]);
  });
});

describe("clear", () => {
  it("is reached when every check is green", () => {
    const result = transitionDeal(
      agreedDeal(),
      "clear",
      context({
        actorUserId: null,
        clearance: { ...CLEAR_SNAPSHOT, buyerSourceOfFunds: "approved" },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.change.actorUserId).toBeNull();
  });

  it("waits while a screening is under review", () => {
    const clearance = {
      ...CLEAR_SNAPSHOT,
      buyerSourceOfFunds: "approved" as const,
      buyer: { kyc: "clear" as const, aml: "review" as const },
    };
    expect(codes(dealBlockers(agreedDeal(), "clear", context({ clearance })))).toEqual([
      "aml_not_clear:buyer",
    ]);
  });

  it("waits for source of funds when the price reaches the threshold", () => {
    for (const status of ["not_requested", "pending", "declined"] as const) {
      const clearance = { ...CLEAR_SNAPSHOT, buyerSourceOfFunds: status };
      expect(codes(dealBlockers(agreedDeal(), "clear", context({ clearance })))).toEqual([
        "source_of_funds_not_satisfied",
      ]);
    }
  });

  it("does not ask for source of funds below the threshold", () => {
    expect(dealBlockers(agreedDeal({ priceMinor: 899_999 }), "clear", context())).toEqual([]);
  });

  it("asks for source of funds at exactly the threshold", () => {
    expect(codes(dealBlockers(agreedDeal({ priceMinor: 900_000 }), "clear", context()))).toEqual([
      "source_of_funds_not_satisfied",
    ]);
  });

  it("counts what the buyer has open elsewhere towards the threshold", () => {
    const clearance = { ...CLEAR_SNAPSHOT, buyerOtherOpenExposureMinor: 500_000 };
    expect(
      codes(dealBlockers(agreedDeal({ priceMinor: 400_000 }), "clear", context({ clearance }))),
    ).toEqual(["source_of_funds_not_satisfied"]);
  });

  it("is satisfied by an approved source of funds", () => {
    const clearance = { ...CLEAR_SNAPSHOT, buyerSourceOfFunds: "approved" as const };
    expect(dealBlockers(agreedDeal(), "clear", context({ clearance }))).toEqual([]);
  });

  it("uses the configured threshold, not a fixed one", () => {
    const policy = resolvePrivateSalePolicy({ ...POLICY, sourceOfFundsThresholdMinor: 6_000_000 });
    expect(dealBlockers(agreedDeal(), "clear", context({ policy }))).toEqual([]);
  });
});

describe("issue invoice", () => {
  const cleared = (over = {}) =>
    agreedDeal({
      stage: "cleared",
      vatTreatment: "margin_scheme",
      sellerCommissionBps: 1500,
      ...over,
    });
  const ctx = (over = {}) =>
    context({
      actorUserId: "u-finance",
      clearance: { ...CLEAR_SNAPSHOT, buyerSourceOfFunds: "approved" },
      ...over,
    });

  it("sets who issued it and when payment is due", () => {
    const result = transitionDeal(cleared(), "issue_invoice", ctx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.change.changes).toEqual({
        invoicedByUserId: "u-finance",
        paymentDueAt: new Date("2026-11-10T10:00:00Z"),
      });
    }
  });

  it("is blocked until finance chooses a VAT treatment", () => {
    expect(codes(dealBlockers(cleared({ vatTreatment: null }), "issue_invoice", ctx()))).toEqual([
      "vat_treatment_not_chosen",
    ]);
  });

  it("is blocked when the chosen treatment is not on the list", () => {
    expect(
      codes(dealBlockers(cleared({ vatTreatment: "zero_rated" }), "issue_invoice", ctx())),
    ).toEqual(["vat_treatment_not_allowed"]);
  });

  it("is blocked while the VAT list has not been configured", () => {
    const policy = resolvePrivateSalePolicy({ ...POLICY, vatTreatments: [] });
    expect(codes(dealBlockers(cleared(), "issue_invoice", ctx({ policy })))).toEqual([
      "vat_treatments_not_configured",
    ]);
  });

  it("is blocked until the seller's commission is set", () => {
    expect(
      codes(dealBlockers(cleared({ sellerCommissionBps: null }), "issue_invoice", ctx())),
    ).toEqual(["commission_not_set"]);
  });

  it("is blocked while the payment deadline has not been configured", () => {
    const policy = resolvePrivateSalePolicy({ ...POLICY, paymentDueDays: null });
    expect(codes(dealBlockers(cleared(), "issue_invoice", ctx({ policy })))).toEqual([
      "payment_due_days_not_configured",
    ]);
  });

  it("checks source of funds again when the price needs it", () => {
    const clearance = { ...CLEAR_SNAPSHOT, buyerSourceOfFunds: "pending" as const };
    expect(codes(dealBlockers(cleared(), "issue_invoice", ctx({ clearance })))).toEqual([
      "source_of_funds_not_satisfied",
    ]);
  });

  it("checks identity and screening again", () => {
    const clearance = {
      ...CLEAR_SNAPSHOT,
      buyerSourceOfFunds: "approved" as const,
      buyer: { kyc: "clear" as const, aml: "review" as const },
    };
    expect(codes(dealBlockers(cleared(), "issue_invoice", ctx({ clearance })))).toEqual([
      "aml_not_clear:buyer",
    ]);
  });

  it("is not needed below the source of funds threshold", () => {
    const clearance = { ...CLEAR_SNAPSHOT, buyerSourceOfFunds: "not_requested" as const };
    expect(
      dealBlockers(cleared({ priceMinor: 500_000 }), "issue_invoice", ctx({ clearance })),
    ).toEqual([]);
  });

  it("cannot be issued by the person who recorded the agreement", () => {
    expect(
      codes(dealBlockers(cleared(), "issue_invoice", ctx({ actorUserId: "u-agreer" }))),
    ).toEqual(["same_person_agreed_and_invoiced"]);
  });

  it("lists every reason at once", () => {
    const policy = resolvePrivateSalePolicy({ ...POLICY, vatTreatments: [], paymentDueDays: null });
    expect(
      codes(
        dealBlockers(
          cleared({ sellerCommissionBps: null, vatTreatment: null }),
          "issue_invoice",
          ctx({ policy, clearance: CLEAR_SNAPSHOT }),
        ),
      ),
    ).toEqual([
      "source_of_funds_not_satisfied",
      "vat_treatments_not_configured",
      "commission_not_set",
      "payment_due_days_not_configured",
    ]);
  });
});

describe("payment, release and settlement", () => {
  it("sets the collection date from configuration when paid", () => {
    const result = transitionDeal(
      deal({ stage: "invoiced", buyer: BUYER }),
      "mark_paid",
      context(),
    );
    expect(result.ok && result.change.changes).toEqual({
      collectionDueAt: new Date("2026-11-17T10:00:00Z"),
    });
  });

  it("is not blocked when no collection deadline is configured", () => {
    const policy = resolvePrivateSalePolicy({ ...POLICY, collectionDueDays: null });
    const result = transitionDeal(
      deal({ stage: "invoiced", buyer: BUYER }),
      "mark_paid",
      context({ policy }),
    );
    expect(result.ok && result.change.changes).toEqual({});
  });
});

describe("cancel", () => {
  it.each(["proposed", "offer", "agreed", "cleared", "invoiced"] as const)(
    "is possible from %s with a reason",
    (stage) => {
      const result = transitionDeal(
        deal({ stage, buyer: BUYER }),
        "cancel",
        context({ cancelReason: "  Seller withdrew the work  " }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.change.to).toBe("cancelled");
        expect(result.change.reason).toBe("Seller withdrew the work");
        expect(result.change.changes).toEqual({
          cancelReason: "Seller withdrew the work",
          cancelledAt: NOW,
        });
      }
    },
  );

  it("needs a reason", () => {
    for (const cancelReason of [undefined, "", "   "]) {
      expect(
        codes(
          dealBlockers(deal({ stage: "offer", buyer: BUYER }), "cancel", context({ cancelReason })),
        ),
      ).toEqual(["cancel_reason_required"]);
    }
  });

  it.each(["paid", "released"] as const)(
    "after %s needs the buyer to be refunded first",
    (stage) => {
      const base = deal({ stage, buyer: BUYER });
      expect(codes(dealBlockers(base, "cancel", context({ cancelReason: "Dispute" })))).toEqual([
        "refund_not_recorded",
      ]);
      expect(
        dealBlockers(base, "cancel", context({ cancelReason: "Dispute", refundRecorded: true })),
      ).toEqual([]);
    },
  );

  it("is not possible once settled or cancelled", () => {
    for (const stage of ["settled", "cancelled"] as const) {
      expect(
        codes(dealBlockers(deal({ stage }), "cancel", context({ cancelReason: "x" }))),
      ).toEqual(["invalid_transition"]);
    }
  });
});

describe("blocker messages", () => {
  it("says each reason in plain words, naming the party", () => {
    expect(describeDealBlocker({ code: "kyc_not_clear", party: "buyer" })).toBe(
      "The buyer has not verified their identity yet.",
    );
    expect(describeDealBlocker({ code: "aml_not_clear", party: "seller" })).toContain(
      "Compliance decides",
    );
    expect(describeDealBlocker({ code: "vat_treatment_not_chosen" })).toBe(
      "Finance has not chosen the VAT treatment yet.",
    );
  });
});

describe("terms locked by agreement", () => {
  it("cannot be agreed without a commission on the deal", () => {
    const offer = deal({ stage: "offer", buyer: BUYER, priceMinor: 4_800_000 });
    expect(codes(dealBlockers(offer, "agree", context()))).toEqual(["commission_not_set"]);
  });

  it("cannot be invoiced while the commission rate or terms version is not configured in policy", () => {
    const cleared = deal({
      stage: "cleared",
      buyer: BUYER,
      priceMinor: 100_000,
      sellerCommissionBps: 1500,
      vatTreatment: "margin_scheme",
      agreedByUserId: "u-other",
    });
    const configured = context();
    expect(codes(dealBlockers(cleared, "issue_invoice", configured))).toEqual([]);
    const noRate = {
      ...configured,
      policy: { ...configured.policy, commissionRateBps: null },
    };
    expect(codes(dealBlockers(cleared, "issue_invoice", noRate))).toContain(
      "commission_rate_not_configured",
    );
    const noTerms = { ...configured, policy: { ...configured.policy, termsVersion: null } };
    expect(codes(dealBlockers(cleared, "issue_invoice", noTerms))).toContain(
      "terms_version_not_configured",
    );
  });
});

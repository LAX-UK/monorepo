import type { BidAuthorityDecision } from "@auction/domain";
import type { IBidLotRulesReader } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { type AutoBidLotRules, validateAutoBidStepAmount } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "./bid-error.js";
import type { IAmlBidGate } from "./bid/aml-bid.gate.js";
import { bidAuthorityError } from "./bid/bid-authority-error.js";
import type { IBidAuthority } from "./bid/bid-authority.service.js";
import type { IBidderRoleGate } from "./bid/bidder-role.gate.js";
import type { IBiddingLimitGate } from "./bid/bidding-limit.gate.js";
import type { IBidIdentityEligibilityGate } from "./bid/identity-bid-eligibility.gate.js";
import type { OperatorPlacementPolicy } from "./bid/operator-placement-policy.js";
import type { SaleRegistrationBidGate } from "./bid/sale-registration-bid.gate.js";
import type { BidEligibilityCheckInput } from "./ports.js";

export type BidEligibilityRuleContext = {
  readonly input: BidEligibilityCheckInput;
  readonly effectiveAmount: number;
  readonly validatedOperatorChannel: boolean;
  lotRow: Awaited<ReturnType<IBidLotRulesReader["findLotBidRules"]>>;
  saleId: string | null;
  memberRole: LegalEntityMemberRole | null;
  authority: BidAuthorityDecision | null;
  operatorBypass: boolean;
};

export type BidEligibilityRule = {
  readonly name: string;
  apply(ctx: BidEligibilityRuleContext): Promise<Result<void, BidError>>;
};

export type BidEligibilityRuleDeps = {
  identityEligibilityGate: IBidIdentityEligibilityGate;
  amlGate: IAmlBidGate;
  lotRulesReader: IBidLotRulesReader;
  bidAuthority: IBidAuthority;
  operatorPolicy: OperatorPlacementPolicy;
  saleRegistrationGate: SaleRegistrationBidGate;
  bidderRoleGate: IBidderRoleGate;
  biddingLimitGate: IBiddingLimitGate;
};

function selfServiceIdentityRule(deps: BidEligibilityRuleDeps): BidEligibilityRule {
  return {
    name: "self_service_identity",
    async apply(ctx) {
      if (ctx.validatedOperatorChannel) return ok(undefined);
      return deps.identityEligibilityGate.assertSelfServiceEligible(ctx.input.placedByUserId);
    },
  };
}

function amlRule(deps: BidEligibilityRuleDeps): BidEligibilityRule {
  return {
    name: "aml",
    apply(ctx) {
      return deps.amlGate.assertCanBid(ctx.input.placedByUserId);
    },
  };
}

function lotExistsRule(deps: BidEligibilityRuleDeps): BidEligibilityRule {
  return {
    name: "lot_exists",
    async apply(ctx) {
      ctx.lotRow = await deps.lotRulesReader.findLotBidRules(ctx.input.lotId);
      if (!ctx.lotRow) {
        return err(new BidError("Lot not found", 404));
      }
      return ok(undefined);
    },
  };
}

function autoBidRulesRule(): BidEligibilityRule {
  return {
    name: "auto_bid_rules",
    async apply(ctx) {
      const lotRow = ctx.lotRow;
      if (!lotRow) return ok(undefined);

      const autoRules: AutoBidLotRules = {
        autoBidEnabled: lotRow.autoBidEnabled ?? true,
        minBidIncrement: lotRow.minBidIncrement,
        autoBidStepMin: lotRow.autoBidStepMin,
        autoBidStepMax: lotRow.autoBidStepMax,
        autoBidStepPresets: lotRow.autoBidStepPresets,
      };

      const { maxAutoBidAmount, autoBidStepAmount } = ctx.input;
      if (maxAutoBidAmount == null && autoBidStepAmount == null) {
        return ok(undefined);
      }
      if (autoRules.autoBidEnabled === false) {
        return err(new BidError("Auto-bid is not enabled for this lot", 403, "auto_bid_disabled"));
      }
      if (autoBidStepAmount != null) {
        const stepErr = validateAutoBidStepAmount(autoRules, autoBidStepAmount);
        if (stepErr) {
          return err(new BidError(stepErr, 400, "auto_bid_step_invalid"));
        }
      }
      return ok(undefined);
    },
  };
}

/**
 * Only members whose role bids for the organisation may bid for it, and buyer agents only with
 * an authorisation that covers this sale. Applies to every channel, operators included.
 */
function bidAuthorityRule(deps: BidEligibilityRuleDeps): BidEligibilityRule {
  return {
    name: "bid_authority",
    async apply(ctx) {
      ctx.saleId = ctx.lotRow?.saleId ?? ctx.input.saleId ?? null;
      const decision = await deps.bidAuthority.resolve({
        userId: ctx.input.placedByUserId,
        legalEntityId: ctx.input.buyerLegalEntityId,
        saleId: ctx.saleId,
      });
      ctx.authority = decision;
      ctx.memberRole = decision.role;
      return decision.allowed ? ok(undefined) : err(bidAuthorityError(decision.reason));
    },
  };
}

/**
 * The account the bid is for must be allowed to bid at all (clients; staff are not bidders).
 * `placedByUserId` is always that bidder, so a clerk placing a bid on a client's behalf passes
 * when the client does. Applies to every channel.
 */
function bidderRoleRule(deps: BidEligibilityRuleDeps): BidEligibilityRule {
  return {
    name: "bidder_role",
    apply(ctx) {
      return deps.bidderRoleGate.assertCanBid(ctx.input.placedByUserId);
    },
  };
}

function operatorCapRule(deps: BidEligibilityRuleDeps): BidEligibilityRule {
  return {
    name: "operator_cap",
    async apply(ctx) {
      const { placedVia, telephoneBookingId, paddleNumber, placedByUserId, buyerLegalEntityId } =
        ctx.input;
      ctx.operatorBypass =
        (placedVia === "telephone" &&
          telephoneBookingId != null &&
          ctx.saleId != null &&
          (await deps.operatorPolicy.isActiveTelephoneBooking(
            telephoneBookingId,
            ctx.saleId,
            placedByUserId,
            buyerLegalEntityId,
          ))) ||
        (placedVia === "saleroom" && ctx.saleId != null && paddleNumber != null);

      if (!ctx.operatorBypass) return ok(undefined);

      try {
        const cap = await deps.operatorPolicy.resolveOperatorCap({
          placedVia: placedVia ?? null,
          telephoneBookingId: telephoneBookingId ?? null,
          saleId: ctx.saleId,
          paddleNumber: paddleNumber ?? null,
        });
        deps.operatorPolicy.assertCapNotExceeded(cap, ctx.effectiveAmount, placedVia ?? null);
      } catch (e) {
        if (e instanceof BidError) return err(e);
        throw e;
      }
      return ok(undefined);
    },
  };
}

function operatorIdentityRule(deps: BidEligibilityRuleDeps): BidEligibilityRule {
  return {
    name: "operator_identity",
    async apply(ctx) {
      if (!ctx.validatedOperatorChannel) return ok(undefined);
      return ctx.operatorBypass
        ? deps.identityEligibilityGate.assertValidatedOperatorEligible(ctx.input.placedByUserId)
        : deps.identityEligibilityGate.assertSelfServiceEligible(ctx.input.placedByUserId);
    },
  };
}

function saleRegistrationRule(deps: BidEligibilityRuleDeps): BidEligibilityRule {
  return {
    name: "sale_registration",
    async apply(ctx) {
      if (!ctx.saleId || !ctx.memberRole) return ok(undefined);
      return deps.saleRegistrationGate.assertCanBid({
        saleId: ctx.saleId,
        placedByUserId: ctx.input.placedByUserId,
        buyerLegalEntityId: ctx.input.buyerLegalEntityId,
        memberRole: ctx.memberRole,
        effectiveAmount: ctx.effectiveAmount,
        operatorBypass: ctx.operatorBypass,
      });
    },
  };
}

/**
 * The bid (or auto-bid ceiling) must fit under every limit that applies, on every channel: a
 * buyer agent's per-lot limit and total, and the organisation's own limit. The lowest wins.
 */
function biddingLimitsRule(deps: BidEligibilityRuleDeps): BidEligibilityRule {
  return {
    name: "bidding_limits",
    async apply(ctx) {
      if (!ctx.authority) return ok(undefined);
      return deps.biddingLimitGate.check({
        legalEntityId: ctx.input.buyerLegalEntityId,
        placedByUserId: ctx.input.placedByUserId,
        lotId: ctx.input.lotId,
        saleId: ctx.saleId,
        amount: ctx.effectiveAmount,
        authority: ctx.authority,
      });
    },
  };
}

/** Ordered bid-eligibility pipeline. Add a new rule here instead of editing the service. */
export function createBidEligibilityRules(deps: BidEligibilityRuleDeps): BidEligibilityRule[] {
  return [
    selfServiceIdentityRule(deps),
    amlRule(deps),
    bidderRoleRule(deps),
    lotExistsRule(deps),
    autoBidRulesRule(),
    bidAuthorityRule(deps),
    operatorCapRule(deps),
    operatorIdentityRule(deps),
    saleRegistrationRule(deps),
    biddingLimitsRule(deps),
  ];
}

export function createBidEligibilityContext(
  input: BidEligibilityCheckInput,
): BidEligibilityRuleContext {
  const { amount, maxAutoBidAmount, placedVia } = input;
  return {
    input,
    effectiveAmount:
      maxAutoBidAmount != null && Number.isFinite(maxAutoBidAmount)
        ? Math.max(amount, maxAutoBidAmount)
        : amount,
    validatedOperatorChannel: placedVia === "telephone" || placedVia === "saleroom",
    lotRow: null,
    saleId: null,
    memberRole: null,
    authority: null,
    operatorBypass: false,
  };
}

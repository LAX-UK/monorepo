import { type AutoBidLotRules, validateAutoBidStepAmount } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "./bid-error.js";
import type { IAmlBidGate } from "./bid/aml-bid.gate.js";
import type { BuyerAgentBidGate } from "./bid/buyer-agent-bid.gate.js";
import type { IBidIdentityEligibilityGate } from "./bid/identity-bid-eligibility.gate.js";
import type { OperatorPlacementPolicy } from "./bid/operator-placement-policy.js";
import type { SaleRegistrationBidGate } from "./bid/sale-registration-bid.gate.js";
import type {
  BidEligibilityCheckInput,
  IBidEligibility,
  IBidLotRulesReader,
  IBidMembershipReader,
} from "./ports.js";

export class BidEligibilityService implements IBidEligibility {
  constructor(
    private readonly identityEligibilityGate: IBidIdentityEligibilityGate,
    private readonly amlGate: IAmlBidGate,
    private readonly lotRulesReader: IBidLotRulesReader,
    private readonly membershipReader: IBidMembershipReader,
    private readonly operatorPolicy: OperatorPlacementPolicy,
    private readonly saleRegistrationGate: SaleRegistrationBidGate,
    private readonly buyerAgentGate: BuyerAgentBidGate,
  ) {}

  async assertCanPlaceBid(input: BidEligibilityCheckInput): Promise<Result<void, BidError>> {
    const effectiveAmount =
      input.maxAutoBidAmount != null && Number.isFinite(input.maxAutoBidAmount)
        ? Math.max(input.amount, input.maxAutoBidAmount)
        : input.amount;
    const validatedOperatorChannel =
      input.placedVia === "telephone" || input.placedVia === "saleroom";

    if (!validatedOperatorChannel) {
      const identityResult = await this.identityEligibilityGate.assertSelfServiceEligible(
        input.placedByUserId,
      );
      if (identityResult.isErr()) return identityResult;
    }

    const amlResult = await this.amlGate.assertCanBid(input.placedByUserId);
    if (amlResult.isErr()) return amlResult;

    const lotRow = await this.lotRulesReader.findLotBidRules(input.lotId);
    if (!lotRow) return err(new BidError("Lot not found", 404));

    const autoRules: AutoBidLotRules = {
      autoBidEnabled: lotRow.autoBidEnabled ?? true,
      minBidIncrement: lotRow.minBidIncrement,
      autoBidStepMin: lotRow.autoBidStepMin,
      autoBidStepMax: lotRow.autoBidStepMax,
      autoBidStepPresets: lotRow.autoBidStepPresets,
    };
    if (input.maxAutoBidAmount != null || input.autoBidStepAmount != null) {
      if (autoRules.autoBidEnabled === false) {
        return err(new BidError("Auto-bid is not enabled for this lot", 403, "auto_bid_disabled"));
      }
      if (input.autoBidStepAmount != null) {
        const stepError = validateAutoBidStepAmount(autoRules, input.autoBidStepAmount);
        if (stepError) {
          return err(new BidError(stepError, 400, "auto_bid_step_invalid"));
        }
      }
    }

    const saleId = lotRow.saleId ?? input.saleId ?? null;
    const membership = await this.membershipReader.findBuyerEntityMembership(
      input.placedByUserId,
      input.buyerLegalEntityId,
    );
    if (!membership.entityExists) {
      return err(new BidError("Buyer legal entity not found", 404));
    }
    const memberRole = membership.memberRole;
    if (!memberRole) {
      return err(new BidError("Not a member of this legal entity", 403, "membership_required"));
    }

    const operatorBypass =
      (input.placedVia === "telephone" &&
        input.telephoneBookingId != null &&
        saleId != null &&
        (await this.operatorPolicy.isActiveTelephoneBooking(
          input.telephoneBookingId,
          saleId,
          input.placedByUserId,
          input.buyerLegalEntityId,
        ))) ||
      (input.placedVia === "saleroom" && saleId != null && input.paddleNumber != null);

    if (operatorBypass) {
      try {
        const cap = await this.operatorPolicy.resolveOperatorCap({
          ...(input.placedVia !== undefined ? { placedVia: input.placedVia } : {}),
          ...(input.telephoneBookingId !== undefined
            ? { telephoneBookingId: input.telephoneBookingId }
            : {}),
          saleId,
          ...(input.paddleNumber !== undefined ? { paddleNumber: input.paddleNumber } : {}),
        });
        this.operatorPolicy.assertCapNotExceeded(cap, effectiveAmount, input.placedVia);
      } catch (caught) {
        if (caught instanceof BidError) return err(caught);
        throw caught;
      }
    }

    if (validatedOperatorChannel) {
      const identityResult = operatorBypass
        ? await this.identityEligibilityGate.assertValidatedOperatorEligible(input.placedByUserId)
        : await this.identityEligibilityGate.assertSelfServiceEligible(input.placedByUserId);
      if (identityResult.isErr()) return identityResult;
    }

    if (saleId) {
      const registrationResult = await this.saleRegistrationGate.assertCanBid({
        saleId,
        placedByUserId: input.placedByUserId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        memberRole,
        effectiveAmount,
        operatorBypass,
      });
      if (registrationResult.isErr()) return registrationResult;
    }

    const agentResult = await this.buyerAgentGate.assertCanBid({
      saleId,
      placedByUserId: input.placedByUserId,
      buyerLegalEntityId: input.buyerLegalEntityId,
      memberRole,
      effectiveAmount,
      operatorBypass,
    });
    if (agentResult.isErr()) return agentResult;
    return ok(undefined);
  }
}

import type { IBidLotRulesReader, IBidMembershipReader } from "@auction/persistence";
import { type AutoBidLotRules, validateAutoBidStepAmount } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { IAmlBidGate } from "./bid/aml-bid.gate.js";
import type { BuyerAgentBidGate } from "./bid/buyer-agent-bid.gate.js";
import type { IKycBidGate } from "./bid/kyc-bid.gate.js";
import type { OperatorPlacementPolicy } from "./bid/operator-placement-policy.js";
import type { SaleRegistrationBidGate } from "./bid/sale-registration-bid.gate.js";
import type { BidEligibilityCheckInput, IBidEligibility } from "./interfaces/bid-eligibility.js";

export class BidEligibilityService implements IBidEligibility {
  constructor(
    private readonly kycGate: IKycBidGate,
    private readonly amlGate: IAmlBidGate,
    private readonly lotRulesReader: IBidLotRulesReader,
    private readonly membershipReader: IBidMembershipReader,
    private readonly operatorPolicy: OperatorPlacementPolicy,
    private readonly saleRegistrationGate: SaleRegistrationBidGate,
    private readonly buyerAgentGate: BuyerAgentBidGate,
  ) {}

  async assertCanPlaceBid(input: BidEligibilityCheckInput): Promise<Result<void, BidError>> {
    const {
      placedByUserId,
      buyerLegalEntityId,
      lotId,
      amount,
      maxAutoBidAmount,
      autoBidStepAmount,
      placedVia,
      telephoneBookingId,
      saleId: inputSaleId,
      paddleNumber,
    } = input;
    const effectiveAmount =
      maxAutoBidAmount != null && Number.isFinite(maxAutoBidAmount)
        ? Math.max(amount, maxAutoBidAmount)
        : amount;

    const kycResult = await this.kycGate.assertCanBid(placedByUserId);
    if (kycResult.isErr()) return kycResult;

    const amlResult = await this.amlGate.assertCanBid(placedByUserId);
    if (amlResult.isErr()) return amlResult;

    const lotRow = await this.lotRulesReader.findLotBidRules(lotId);
    if (!lotRow) {
      return err(new BidError("Lot not found", 404));
    }

    const autoRules: AutoBidLotRules = {
      autoBidEnabled: lotRow.autoBidEnabled ?? true,
      minBidIncrement: lotRow.minBidIncrement,
      autoBidStepMin: lotRow.autoBidStepMin,
      autoBidStepMax: lotRow.autoBidStepMax,
      autoBidStepPresets: lotRow.autoBidStepPresets,
    };

    if (maxAutoBidAmount != null || autoBidStepAmount != null) {
      if (autoRules.autoBidEnabled === false) {
        return err(new BidError("Auto-bid is not enabled for this lot", 403, "auto_bid_disabled"));
      }
      if (autoBidStepAmount != null) {
        const stepErr = validateAutoBidStepAmount(autoRules, autoBidStepAmount);
        if (stepErr) {
          return err(new BidError(stepErr, 400, "auto_bid_step_invalid"));
        }
      }
    }

    const saleId = lotRow.saleId ?? inputSaleId ?? null;

    const memberRole = await this.membershipReader.findActiveMemberRole(
      placedByUserId,
      buyerLegalEntityId,
    );
    if (!memberRole) {
      return err(new BidError("Not a member of this legal entity", 403, "membership_required"));
    }

    const operatorBypass =
      (placedVia === "telephone" &&
        telephoneBookingId != null &&
        saleId != null &&
        (await this.operatorPolicy.isActiveTelephoneBooking(telephoneBookingId, saleId))) ||
      (placedVia === "saleroom" && saleId != null && paddleNumber != null);

    if (operatorBypass) {
      try {
        const cap = await this.operatorPolicy.resolveOperatorCap({
          placedVia: placedVia ?? null,
          telephoneBookingId: telephoneBookingId ?? null,
          saleId,
          paddleNumber: paddleNumber ?? null,
        });
        this.operatorPolicy.assertCapNotExceeded(cap, effectiveAmount, placedVia ?? null);
      } catch (e) {
        if (e instanceof BidError) return err(e);
        throw e;
      }
    }

    if (saleId) {
      const regResult = await this.saleRegistrationGate.assertCanBid({
        saleId,
        placedByUserId,
        buyerLegalEntityId,
        memberRole,
        effectiveAmount,
        operatorBypass,
      });
      if (regResult.isErr()) return regResult;
    }

    const agentResult = await this.buyerAgentGate.assertCanBid({
      saleId,
      placedByUserId,
      buyerLegalEntityId,
      memberRole,
      effectiveAmount,
      operatorBypass,
    });
    if (agentResult.isErr()) return agentResult;

    return ok(undefined);
  }
}

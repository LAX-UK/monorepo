import type { PayPlanGate } from "@auction/types";
import type { OrganisationBuyingErrorCode } from "../interfaces/organisation-buying-service.js";

/**
 * Why the account itself cannot pay, from the gate of a pay plan: it is not the payer, has not
 * finished setting up, or is closed or on hold. `null` when the account can pay.
 *
 * Checks on the amount (anti-money-laundering, source of funds, the finance threshold) are not
 * here: they are decided when the payment starts, where a missing check is also opened.
 */
export function accountGateRefusal(gate: PayPlanGate): OrganisationBuyingErrorCode | null {
  switch (gate.kind) {
    case "not_payer":
      return "pay_several_nothing_payable";
    case "onboarding_required":
      return "onboarding_required";
    case "refused":
    case "held":
      return gate.reason;
    case "compliance":
    case "finance_check":
    case "clear":
      return null;
  }
}

import { SaleroomRegisterToBid } from "@/components/sections/saleroom/saleroom-register-to-bid";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "@/lib/bid/policies/types";
import { blockBid } from "./block-decision";

const REGISTRATION_PREVIEW =
  "After approval, you can place a one-time bid or set an auto-bid for this sale.";

export const saleRegistrationPolicy: BidPolicy = {
  id: "sale-registration",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    const gate = ctx.saleRegistrationBidGate;
    if (!ctx.user || !gate?.requiresRegistration) {
      return { kind: "allow" };
    }

    const { registrationStatus } = gate;

    if (registrationStatus === "approved") {
      return { kind: "allow" };
    }

    if (registrationStatus === "pending") {
      return blockBid("sale-registration-pending", {
        tone: "info",
        title: "Registration pending",
        detail:
          "Your registration for this sale is awaiting approval. You can bid once our team approves your paddle.",
        action: { kind: "status", label: "Awaiting approval", shortLabel: "Pending" },
        preview: REGISTRATION_PREVIEW,
      });
    }

    if (registrationStatus === "rejected") {
      return blockBid("sale-registration-rejected", {
        tone: "danger",
        title: "Registration not approved",
        detail: "Contact the saleroom or update your registration details before trying again.",
        action: {
          kind: "panel",
          label: "Update registration",
          shortLabel: "Update",
        },
        content: (
          <SaleroomRegisterToBid
            saleId={gate.saleId}
            loginNextPath={ctx.loginNextPath}
            isAuthenticated
            show
            buyerEntities={gate.buyerEntities}
            myRegistrations={gate.myRegistrations}
            kycApproved={gate.kycApproved}
            kycFeedback={gate.kycFeedback ?? null}
            orgModuleEnabled={ctx.orgModuleEnabled !== false}
          />
        ),
        preview: REGISTRATION_PREVIEW,
      });
    }

    return blockBid("sale-registration-required", {
      tone: "warning",
      title: "Register to bid",
      detail: "Buyer agents must register and be approved for this sale before placing bids.",
      action: { kind: "panel", label: "Complete registration", shortLabel: "Register" },
      content: (
        <SaleroomRegisterToBid
          saleId={gate.saleId}
          loginNextPath={ctx.loginNextPath}
          isAuthenticated
          show
          buyerEntities={gate.buyerEntities}
          myRegistrations={gate.myRegistrations}
          kycApproved={gate.kycApproved}
          kycFeedback={gate.kycFeedback ?? null}
          orgModuleEnabled={ctx.orgModuleEnabled !== false}
        />
      ),
      preview: REGISTRATION_PREVIEW,
    });
  },
};

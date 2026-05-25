import { SaleroomRegisterToBid } from "@/components/sections/saleroom/saleroom-register-to-bid";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "@/lib/bid/policies/types";

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
      return {
        kind: "block",
        viewId: "sale-registration-pending",
        render: () => (
          <div className="rounded-lg bg-surface-container-high/80 p-6 ring-1 ring-outline-variant/10">
            <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Registration pending
            </p>
            <p className="mt-2 font-body text-sm text-on-surface-variant">
              Your registration to bid on this sale is awaiting approval. You can place bids once
              our team approves your paddle.
            </p>
          </div>
        ),
      };
    }

    if (registrationStatus === "rejected") {
      return {
        kind: "block",
        viewId: "sale-registration-rejected",
        render: () => (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-container-high/80 p-6 ring-1 ring-outline-variant/10">
              <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Registration not approved
              </p>
              <p className="mt-2 font-body text-sm text-on-surface-variant">
                Your registration for this sale was not approved. Contact the saleroom or submit an
                updated registration below.
              </p>
            </div>
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
          </div>
        ),
      };
    }

    return {
      kind: "block",
      viewId: "sale-registration-required",
      render: () => (
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-container-high/80 p-6 ring-1 ring-outline-variant/10">
            <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Register to bid
            </p>
            <p className="mt-2 font-body text-sm text-on-surface-variant">
              Buyer agents must register and be approved for this sale before placing bids.
            </p>
          </div>
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
        </div>
      ),
    };
  },
};

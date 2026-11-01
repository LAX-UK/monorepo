"use client";

import { SaleroomFollowToggle } from "@/components/sections/saleroom/saleroom-follow-toggle";
import {
  RegisterHelperText,
  SaleroomRegisterToBid,
  registerToBidHeroCaption,
  registerToBidNeedsAgentFormBand,
} from "@/components/sections/saleroom/saleroom-register-to-bid";
import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import { saleLifecycleActions } from "@/lib/sale/sale-lifecycle-actions";
import type { LegalEntityMemberRole, SaleDeliveryMode } from "@auction/types";
import { Button } from "@auction/ui/lax";
import Link from "next/link";
import type { SaleHeroVM } from "./view-models";

type BuyerEntity = { id: string; displayName: string; memberRole: LegalEntityMemberRole };

type Props = {
  hero: SaleHeroVM;
  isAuthenticated: boolean;
  deliveryMode?: SaleDeliveryMode;
  saleId: string;
  saleHref: string;
  initialFollowing: boolean;
  registerToBid?: {
    show: boolean;
    buyerEntities: BuyerEntity[];
    myRegistrations: {
      buyerLegalEntityId: string;
      status: string;
      bidLimit?: string | null;
    }[];
    kycApproved: boolean;
    kycFeedback?: KycUserFeedbackDto | null;
    orgModuleEnabled?: boolean;
    saleCurrency?: string;
    /** Organisations whose state closes registration, said before the person tries. */
    registrationPaused?: readonly { id: string; title: string; line: string }[];
  };
  hasApprovedRegistration?: boolean;
};

function SaleroomHeroPrimaryCta({
  hero,
  isAuthenticated,
  deliveryMode,
}: {
  hero: SaleHeroVM;
  isAuthenticated: boolean;
  deliveryMode: SaleDeliveryMode;
}) {
  if (!saleAllowsWebBidding(deliveryMode)) {
    if (hero.status === "scheduled" || hero.status === "draft") {
      return (
        <Button variant="primary" className="shrink-0" asChild>
          <Link href="#plan-visit">Plan your visit</Link>
        </Button>
      );
    }
    return null;
  }

  if (isAuthenticated || !saleLifecycleActions(hero.status).register) {
    return null;
  }

  return (
    <Button variant="primary" className="shrink-0" asChild>
      <a href={buildHostedLoginStartHref({ intent: "signup" })}>Register to bid</a>
    </Button>
  );
}

/** Hero actions: one row, the primary first and Notify me after it, then any caption or register form. */
export function SaleroomHeroActionRow({
  hero,
  isAuthenticated,
  deliveryMode = "online",
  saleId,
  saleHref,
  initialFollowing,
  registerToBid,
  hasApprovedRegistration = false,
}: Props) {
  const actions = saleLifecycleActions(hero.status);
  const registerBase =
    registerToBid?.show && actions.register
      ? {
          show: registerToBid.show,
          isAuthenticated,
          kycApproved: registerToBid.kycApproved,
          kycFeedback: registerToBid.kycFeedback ?? null,
          buyerEntities: registerToBid.buyerEntities,
        }
      : null;

  const caption = registerBase ? registerToBidHeroCaption(registerBase) : null;
  const showAgentForm = registerBase ? registerToBidNeedsAgentFormBand(registerBase) : false;
  const primaryCta = (
    <SaleroomHeroPrimaryCta
      hero={hero}
      isAuthenticated={isAuthenticated}
      deliveryMode={deliveryMode}
    />
  );
  const registerButton =
    registerToBid?.show && actions.register && isAuthenticated ? (
      <SaleroomRegisterToBid
        saleId={saleId}
        loginNextPath={saleHref}
        isAuthenticated={isAuthenticated}
        show={registerToBid.show}
        buyerEntities={registerToBid.buyerEntities}
        myRegistrations={registerToBid.myRegistrations}
        kycApproved={registerToBid.kycApproved}
        kycFeedback={registerToBid.kycFeedback ?? null}
        orgModuleEnabled={registerToBid.orgModuleEnabled !== false}
        saleCurrency={registerToBid.saleCurrency ?? "GBP"}
        layout="button"
      />
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {hasApprovedRegistration ? (
        <span className="inline-flex w-fit items-center rounded border border-primary/30 bg-primary/5 px-3 py-1 font-label text-xs font-medium text-primary">
          You&apos;re registered
        </span>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {primaryCta}
        {registerButton}
        {actions.follow ? (
          <SaleroomFollowToggle
            saleId={saleId}
            loginNextPath={saleHref}
            initialFollowing={initialFollowing}
            isAuthenticated={isAuthenticated}
            label="Notify me"
          />
        ) : null}
      </div>
      {caption ? (
        <RegisterHelperText className="max-w-xl text-on-surface-variant">
          {caption}
        </RegisterHelperText>
      ) : null}
      {isAuthenticated && registerToBid?.show && actions.register
        ? (registerToBid.registrationPaused ?? []).map((paused) => (
            <RegisterHelperText key={paused.id} className="max-w-xl text-on-surface-variant">
              <span data-testid="registration-paused">
                {paused.title}. {paused.line}
              </span>
            </RegisterHelperText>
          ))
        : null}
      {showAgentForm && registerToBid ? (
        <div id="register-to-bid" className="scroll-mt-[calc(var(--header-height)+1rem)] pt-1">
          <SaleroomRegisterToBid
            saleId={saleId}
            loginNextPath={saleHref}
            isAuthenticated={isAuthenticated}
            show={registerToBid.show}
            buyerEntities={registerToBid.buyerEntities}
            myRegistrations={registerToBid.myRegistrations}
            kycApproved={registerToBid.kycApproved}
            kycFeedback={registerToBid.kycFeedback ?? null}
            orgModuleEnabled={registerToBid.orgModuleEnabled !== false}
            saleCurrency={registerToBid.saleCurrency ?? "GBP"}
            layout="form"
          />
        </div>
      ) : null}
    </div>
  );
}

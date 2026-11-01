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
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
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

const heroCtaSizing = "h-10 min-h-10 px-5 font-body text-base font-semibold";

function SaleroomHeroPrimaryCta({
  hero,
  isAuthenticated,
  deliveryMode,
}: {
  hero: SaleHeroVM;
  isAuthenticated: boolean;
  deliveryMode: SaleDeliveryMode;
}) {
  const ctaClassName = cn(heroCtaSizing, "shrink-0");

  if (!saleAllowsWebBidding(deliveryMode)) {
    if (hero.status === "scheduled" || hero.status === "draft") {
      return (
        <Button variant="cta" size="lg" className={ctaClassName} asChild>
          <Link href="#plan-visit">Plan visit →</Link>
        </Button>
      );
    }
    return null;
  }

  if (isAuthenticated || !saleLifecycleActions(hero.status).register) {
    return null;
  }

  return (
    <Button variant="cta" size="lg" className={ctaClassName} asChild>
      <a href={buildHostedLoginStartHref({ intent: "signup" })}>Register to Bid →</a>
    </Button>
  );
}

/** Hero actions: primary CTAs, optional KYC caption, register form band, Notify me footer. */
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
        <span className="inline-flex w-fit items-center rounded border border-primary/30 bg-primary/5 px-3 py-1 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-primary">
          You&apos;re registered
        </span>
      ) : null}
      {primaryCta || registerButton ? (
        <div className="flex flex-wrap items-center gap-3">
          {primaryCta}
          {registerButton}
        </div>
      ) : null}
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
      {actions.follow ? (
        <div className="flex flex-wrap items-end justify-end gap-3">
          <SaleroomFollowToggle
            saleId={saleId}
            loginNextPath={saleHref}
            initialFollowing={initialFollowing}
            isAuthenticated={isAuthenticated}
            size="lg"
            appearance="outlined-block"
            label="Notify me"
          />
        </div>
      ) : null}
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

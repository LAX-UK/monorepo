"use client";

import { AddSaleToCalendarButton } from "@/components/sections/artwork/onsite/onsite-calendar-actions";
import { SaleroomFollowToggle } from "@/components/sections/saleroom/saleroom-follow-toggle";
import {
  RegisterHelperText,
  SaleroomRegisterToBid,
  registerToBidHeroCaption,
  registerToBidNeedsAgentFormBand,
} from "@/components/sections/saleroom/saleroom-register-to-bid";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import { saleroomHeroActionSizing } from "@/lib/ui/overlay-tone-classes";
import type { LegalEntityMemberRole, Sale, SaleDeliveryMode } from "@auction/types";
import { LiveDot, cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { formatPostalAddressLines } from "@auction/validators";
import Link from "next/link";
import type { SaleHeroVM } from "./view-models";

type BuyerEntity = { id: string; displayName: string; memberRole: LegalEntityMemberRole };

type Props = {
  hero: SaleHeroVM;
  isAuthenticated: boolean;
  deliveryMode?: SaleDeliveryMode;
  streamUrl?: string | null;
  saleId: string;
  saleHref: string;
  initialFollowing: boolean;
  sale?: Sale;
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
  };
};

function locationOneLine(sale: Sale): string {
  const lines = formatPostalAddressLines(sale);
  return [sale.locationName, ...lines].filter(Boolean).join(", ");
}

function SaleroomHeroPrimaryCta({
  hero,
  isAuthenticated,
  deliveryMode,
  streamUrl,
}: {
  hero: SaleHeroVM;
  isAuthenticated: boolean;
  deliveryMode: SaleDeliveryMode;
  streamUrl: string | null;
}) {
  const ctaClassName = cn(saleroomHeroActionSizing, "shrink-0");

  if (!saleAllowsWebBidding(deliveryMode)) {
    if (hero.isLive && streamUrl) {
      return (
        <Button variant="cta" size="md" className={cn(ctaClassName, "gap-2")} asChild>
          <a href={streamUrl} target="_blank" rel="noopener noreferrer">
            <LiveDot className="live-dot-pulse h-2 w-2" />
            Watch live stream
          </a>
        </Button>
      );
    }
    if (hero.status === "scheduled" || hero.status === "draft") {
      return (
        <Button variant="cta" size="md" className={ctaClassName} asChild>
          <Link href="#plan-visit">Plan your visit →</Link>
        </Button>
      );
    }
    return (
      <Button variant="cta" size="md" className={ctaClassName} asChild>
        <Link href="#catalog">{isAuthenticated ? "Browse Lots →" : "View catalogue →"}</Link>
      </Button>
    );
  }

  if (isAuthenticated) {
    return (
      <Button variant="cta" size="md" className={ctaClassName} asChild>
        <Link href="#catalog">Browse Lots →</Link>
      </Button>
    );
  }

  return (
    <Button variant="cta" size="md" className={ctaClassName} asChild>
      <Link href="/register">Register to Bid →</Link>
    </Button>
  );
}

/** Two-band hero actions: button row, optional caption, optional agent form band. */
export function SaleroomHeroActionRow({
  hero,
  isAuthenticated,
  deliveryMode = "online",
  streamUrl = null,
  saleId,
  saleHref,
  initialFollowing,
  sale,
  registerToBid,
}: Props) {
  const isOnsiteScheduled =
    sale != null &&
    !saleAllowsWebBidding(sale.deliveryMode) &&
    (sale.status === "scheduled" || sale.status === "draft");

  const registerBase = registerToBid?.show
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

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <SaleroomHeroPrimaryCta
          hero={hero}
          isAuthenticated={isAuthenticated}
          deliveryMode={deliveryMode}
          streamUrl={streamUrl}
        />
        {registerToBid?.show && isAuthenticated ? (
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
        ) : null}
        {isOnsiteScheduled && sale ? (
          <AddSaleToCalendarButton
            sale={sale}
            lotTitle={sale.title}
            locationLine={locationOneLine(sale)}
            className="h-10 min-h-10 border-brand-400 font-body text-base font-semibold"
          />
        ) : null}
        <SaleroomFollowToggle
          saleId={saleId}
          loginNextPath={saleHref}
          initialFollowing={initialFollowing}
          isAuthenticated={isAuthenticated}
          size="lg"
          appearance="outlined-block"
          label="Follow"
        />
      </div>
      {caption ? <RegisterHelperText className="max-w-xl">{caption}</RegisterHelperText> : null}
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

import { AddSaleToCalendarButton } from "@/components/sections/artwork/onsite/onsite-calendar-actions";
import { SaleroomFollowToggle } from "@/components/sections/saleroom/saleroom-follow-toggle";
import { SaleroomRegisterToBid } from "@/components/sections/saleroom/saleroom-register-to-bid";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import type { LegalEntityMemberRole, Sale } from "@auction/types";
import { formatPostalAddressLines } from "@auction/validators";

type BuyerEntity = { id: string; displayName: string; memberRole: LegalEntityMemberRole };

type Props = {
  saleId: string;
  saleHref: string;
  isAuthenticated: boolean;
  initialFollowing: boolean;
  sale?: Sale;
  registerToBid?: {
    show: boolean;
    buyerEntities: BuyerEntity[];
    myRegistrations: { buyerLegalEntityId: string; status: string }[];
    kycApproved: boolean;
    kycFeedback?: KycUserFeedbackDto | null;
    orgModuleEnabled?: boolean;
  };
};

function locationOneLine(sale: Sale): string {
  const lines = formatPostalAddressLines(sale);
  return [sale.locationName, ...lines].filter(Boolean).join(", ");
}

/** Sale hero: follow + optional register-to-bid (timed online sales) or onsite calendar. */
export function SaleroomHeroActions({
  saleId,
  saleHref,
  isAuthenticated,
  initialFollowing,
  sale,
  registerToBid,
}: Props) {
  const isOnsiteScheduled =
    sale != null &&
    !saleAllowsWebBidding(sale.deliveryMode) &&
    (sale.status === "scheduled" || sale.status === "draft");

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch justify-end gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-start">
      {registerToBid?.show ? (
        <div id="register-to-bid" className="scroll-mt-[calc(var(--header-height)+1rem)]">
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
          />
        </div>
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
  );
}

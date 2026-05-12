import { SaleroomFollowToggle } from "@/components/sections/saleroom/saleroom-follow-toggle";
import { SaleroomRegisterToBid } from "@/components/sections/saleroom/saleroom-register-to-bid";
import type { LegalEntityMemberRole } from "@auction/types";

type BuyerEntity = { id: string; displayName: string; memberRole: LegalEntityMemberRole };

type Props = {
  saleId: string;
  saleHref: string;
  isAuthenticated: boolean;
  initialFollowing: boolean;
  registerToBid?: {
    show: boolean;
    buyerEntities: BuyerEntity[];
    myRegistrations: { buyerLegalEntityId: string; status: string }[];
    kycApproved: boolean;
  };
};

/** Sale hero: follow + optional register-to-bid (timed online sales). */
export function SaleroomHeroActions({
  saleId,
  saleHref,
  isAuthenticated,
  initialFollowing,
  registerToBid,
}: Props) {
  return (
    <div className="flex w-full min-w-0 flex-col items-stretch justify-end gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-start">
      {registerToBid?.show ? (
        <SaleroomRegisterToBid
          saleId={saleId}
          loginNextPath={saleHref}
          isAuthenticated={isAuthenticated}
          show={registerToBid.show}
          buyerEntities={registerToBid.buyerEntities}
          myRegistrations={registerToBid.myRegistrations}
          kycApproved={registerToBid.kycApproved}
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

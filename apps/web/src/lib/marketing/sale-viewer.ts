import { splitBuyerMembershipsByState } from "@/lib/bid/buyer-entity-state";
import { resolveKycSurfaceFeedback } from "@/lib/bid/resolve-kyc-bid-gate";
import type { SessionUser } from "@/lib/data/contracts";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import type { SaleRegistrationMineRow } from "@/lib/data/http/sales.types";
import { organisationBidReasonCopy } from "@/lib/presenters/organisation-state/organisation-state-copy";
import { resolveViewerParticipation } from "@/lib/presenters/viewer-participation";
import type { TelephoneBookingSnapshot } from "@/lib/telephone/telephone-booking-types";
import { roleBidsThroughAuthorisation } from "@auction/domain";
import type { LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";

/*
 * The part of the sale page that belongs to the person looking at it (CO-7).
 *
 * The page itself is rendered once for everyone, as a signed-out visitor sees it, so it can be
 * cached. Whatever depends on who is looking (following, watching, registering, telephone
 * bidding, KYC) is this object: the server renders `SIGNED_OUT_SALE_VIEWER`, and the browser
 * replaces it with the answer of `GET /api/sales/:id/me`, which is no-store and private.
 */

export type SaleroomBuyerEntity = {
  id: string;
  displayName: string;
  memberRole: LegalEntityMemberRole;
};

/** An organisation whose state closes registration, with the words for why. */
export type SaleroomRegistrationPaused = { id: string; title: string; line: string };

export type SaleroomMyRegistration = Pick<
  SaleRegistrationMineRow,
  "buyerLegalEntityId" | "status" | "bidLimit" | "paddleNumber" | "checkedInAt"
>;

export type SaleTelephoneBookingVM = TelephoneBookingSnapshot;

export type SaleViewerVM = {
  isAuthenticated: boolean;
  /** False for staff and others who may not bid; true for a signed-out visitor (they may sign in). */
  canParticipateAsBuyer: boolean;
  isFollowing: boolean;
  /** Lots the person watches (their own watchlist ids only). */
  watchedLotIds: string[];
  buyerEntities: SaleroomBuyerEntity[];
  registrationPaused: SaleroomRegistrationPaused[];
  myRegistrations: SaleroomMyRegistration[];
  kycApproved: boolean;
  kycFeedback: KycUserFeedbackDto | null;
  orgModuleEnabled: boolean;
  telephoneBooking: SaleTelephoneBookingVM | null;
  mobile: string | null;
  phoneNumberVerified: boolean;
  mobileDisplay: string | null;
};

export type SaleViewerInput = {
  session: SessionUser | null;
  isFollowing: boolean;
  watchedLotIds: Iterable<string>;
  actingMemberships: ReadonlyArray<{
    id: string;
    displayName: string;
    role: LegalEntityMemberRole;
    status: LegalEntityStatus;
  }> | null;
  mySaleRegs: SaleRegistrationMineRow[];
  kycSummary: Parameters<typeof resolveKycSurfaceFeedback>[0]["summary"];
  kycUnavailable: boolean;
  orgModuleEnabled: boolean;
  telephoneBooking: SaleTelephoneBookingVM | null;
};

export function buildSaleViewerVM(input: SaleViewerInput): SaleViewerVM {
  const { session } = input;
  const viewer = resolveViewerParticipation(session);

  // The same state table as the server: an organisation whose state closes bidding is not
  // offered for registration, and a buyer agent of one is told why instead.
  const byState = splitBuyerMembershipsByState(input.actingMemberships ?? []);
  const buyerEntities = byState.open.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    memberRole: m.role,
  }));
  const registrationPaused = byState.paused
    .filter((m) => roleBidsThroughAuthorisation(m.role))
    .map((m) => {
      const copy = organisationBidReasonCopy(m.reason, { organisationName: m.displayName });
      return { id: m.id, title: copy.title, line: copy.line };
    });

  const kycApproved = session?.kycStatus === "approved";
  return {
    isAuthenticated: viewer.isAuthenticated,
    canParticipateAsBuyer: viewer.canParticipateAsBuyer,
    isFollowing: input.isFollowing,
    watchedLotIds: [...input.watchedLotIds],
    buyerEntities,
    registrationPaused,
    myRegistrations: input.mySaleRegs.map((r) => ({
      buyerLegalEntityId: r.buyerLegalEntityId,
      status: r.status,
      bidLimit: r.bidLimit,
      paddleNumber: r.paddleNumber,
      checkedInAt: r.checkedInAt,
    })),
    kycApproved,
    kycFeedback: kycApproved
      ? null
      : resolveKycSurfaceFeedback({ summary: input.kycSummary, unavailable: input.kycUnavailable }),
    orgModuleEnabled: input.orgModuleEnabled,
    telephoneBooking: input.telephoneBooking,
    mobile: session?.phoneNumber ?? session?.mobile ?? null,
    phoneNumberVerified: session?.phoneNumberVerified === true,
    mobileDisplay: session?.mobileDisplay ?? null,
  };
}

/** What a signed-out visitor sees, and what the cached page is rendered with. */
export const SIGNED_OUT_SALE_VIEWER: SaleViewerVM = buildSaleViewerVM({
  session: null,
  isFollowing: false,
  watchedLotIds: [],
  actingMemberships: null,
  mySaleRegs: [],
  kycSummary: null,
  kycUnavailable: false,
  orgModuleEnabled: false,
  telephoneBooking: null,
});

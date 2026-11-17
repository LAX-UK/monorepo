import type { Consignor, ConsignorAgreement } from "@auction/artwork-register-contracts";
import type { AdminMoveAgreement } from "@auction/shop-contracts";
import { MoveAgreementService } from "../application/admin/move-agreement.service.js";

export const CONSIGNOR_PARTY_ID = "66666666-6666-4666-8666-666666666666";

/** A consignor agreement version, in force for LAX Bid and lax.art from 3 Mar 2026 to 2 Mar 2027. */
export function consignorAgreement(over: Partial<ConsignorAgreement> = {}): ConsignorAgreement {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    agreementId: "77777777-7777-4777-8777-777777777777",
    version: 1,
    partyId: CONSIGNOR_PARTY_ID,
    places: ["lax_bid", "lax_art"],
    startsOn: "2026-03-03",
    endsOn: "2027-03-02",
    lowestPricePence: null,
    commissionBasisPoints: null,
    signedFileKey: "consignor-agreements/example/signed.pdf",
    note: null,
    status: "current",
    replacesId: null,
    createdBy: "staff:user-1",
    createdAt: new Date("2026-03-03T10:00:00Z"),
    replacedAt: null,
    retiredAt: null,
    retiredBy: null,
    ...over,
  };
}

/** A real `MoveAgreementService` over fixed data: the consignor and their agreements. */
export function moveAgreementsOver(input: {
  consignor: Consignor | null;
  agreements?: ConsignorAgreement[];
  displayName?: string;
  now: () => Date;
}): MoveAgreementService {
  return new MoveAgreementService({
    reads: {
      currentConsignor: async () => input.consignor,
      listAgreements: async (partyId) =>
        (input.agreements ?? []).filter((agreement) => agreement.partyId === partyId),
      consignorParty: async (partyId) => ({
        partyId,
        displayName: input.displayName ?? "Example Gallery Ltd",
      }),
    },
    now: input.now,
  });
}

/** The line a move dialog gets for a work LAX owns: no agreement needed. */
export function laxOwnsMoveAgreement(place: AdminMoveAgreement["place"]): AdminMoveAgreement {
  return {
    place,
    state: "lax_owns",
    outcome: "allowed",
    checkboxFallbackUntil: "2027-01-31",
    consignor: null,
    agreement: null,
    lowestPricePence: null,
    canAddAgreement: false,
  };
}

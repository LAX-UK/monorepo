import {
  CONSIGNMENT_PLACE_LABELS,
  CONSIGNOR_CHECKBOX_FALLBACK_LAST_DAY,
  type ConsignorAgreement,
  type MoveAgreementReading,
  type MoveAgreementRecord,
  agreementDay,
  checkLowestPrice,
  moveAgreementRecord,
  readMoveAgreement,
} from "@auction/artwork-register-contracts";
import type { AdminMoveAgreement } from "@auction/shop-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import type { MoveAgreementReads } from "../ports/move-agreement.ports.js";

/** The places a move dialog offers a work at. Private sale has no move dialog. */
export type MovePlace = AdminMoveAgreement["place"];

/** One reading of the agreement for a move, with what the dialog shows and what history keeps. */
export type MoveAgreementRead = {
  reading: MoveAgreementReading<ConsignorAgreement>;
  /** Everything, before `moveAgreementForViewer` hides what this person may not read. */
  view: AdminMoveAgreement;
  /** Refuses a move the reading blocks, or one that needs the checkbox and did not tick it. */
  assertAllowed(input: { consignorAgreed: boolean }): void;
  /** Whether `pricePence` is below the lowest price of the agreement in force. */
  belowLowestPrice(pricePence: number): boolean;
  record(options?: { belowLowestPrice?: boolean }): MoveAgreementRecord;
};

/**
 * Reads the consignor agreement a move depends on (ZI-5, decision pack 17 November 2026, section
 * 1, option B): who consigned the work, which of their agreements covers the place today, and what
 * the move does about it. The move services ask this both for the dialog and again when the move
 * is made, so a change in between is caught.
 */
export class MoveAgreementService {
  constructor(
    private readonly deps: {
      reads: MoveAgreementReads;
      now?: () => Date;
    },
  ) {}

  async read(registerId: string, place: MovePlace): Promise<MoveAgreementRead> {
    const day = agreementDay((this.deps.now ?? (() => new Date()))());
    const consignor = await this.deps.reads.currentConsignor(registerId);
    const partyId = consignor?.kind === "client" ? consignor.partyId : null;
    const [agreements, party] = partyId
      ? await Promise.all([
          this.deps.reads.listAgreements(partyId),
          this.deps.reads.consignorParty(partyId),
        ])
      : [[], null];
    const reading = readMoveAgreement({ consignor, agreements, place, day });
    const inForce = reading.state === "in_force" ? reading.agreement : null;
    const view: AdminMoveAgreement = {
      place,
      state: reading.state,
      outcome: reading.check.outcome,
      checkboxFallbackUntil: CONSIGNOR_CHECKBOX_FALLBACK_LAST_DAY,
      consignor:
        partyId !== null ? { partyId, displayName: party?.displayName ?? "the consignor" } : null,
      agreement: reading.agreement
        ? {
            id: reading.agreement.id,
            agreementId: reading.agreement.agreementId,
            version: reading.agreement.version,
            places: reading.agreement.places,
            startsOn: reading.agreement.startsOn,
            endsOn: reading.agreement.endsOn,
            retiredOn: reading.agreement.retiredAt
              ? agreementDay(reading.agreement.retiredAt)
              : null,
          }
        : null,
      lowestPricePence: inForce?.lowestPricePence ?? null,
      canAddAgreement: false,
    };
    return {
      reading,
      view,
      assertAllowed: ({ consignorAgreed }) => {
        const { check } = reading;
        if (check.outcome === "blocked") {
          throw new ShopDomainError(
            check.reason === "no_consignor"
              ? "Set who consigned this work first."
              : `No agreement covers ${CONSIGNMENT_PLACE_LABELS[place]} for this work's consignor. Add one on the client's page first.`,
          );
        }
        if (check.outcome === "checkbox_fallback" && !consignorAgreed) {
          throw new ShopDomainError("Confirm the consignor agreed to sell at auction.");
        }
      },
      belowLowestPrice: (pricePence) =>
        inForce !== null && checkLowestPrice(inForce, pricePence).status === "below",
      record: (options) => moveAgreementRecord(reading, place, options),
    };
  }
}

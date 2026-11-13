import {
  SELLER_RULE_VERSION,
  type SellerTermsSnapshot,
  commissionPercentToBps,
  sellerProceeds,
} from "@auction/domain";
import type {
  ISaleSellerTermsStore,
  ISignedAgreementWriter,
  IStaffLotSellerProceedsReader,
  IUploadObjectDescriber,
  StaffLotSellerProceedsFacts,
} from "@auction/persistence/interfaces";
import {
  SIGNED_AGREEMENT_MAX_BYTES,
  SIGNED_AGREEMENT_MESSAGES,
  type SignedAgreementErrors,
  checkSignedAgreement,
  signedAgreementCommission,
} from "@auction/validators";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { SellerProceedsError } from "./seller-proceeds-errors.js";

/** The upload kind a signed agreement is sent as. */
export const SIGNED_AGREEMENT_UPLOAD_KIND = "signed_consignment_agreement";

export type RecordSignedAgreementCommand = {
  lotId: string;
  commissionPercent: string;
  /** London calendar day. */
  signedOn: string;
  uploadObjectId: string | null;
  reason: string;
  replace: boolean;
  actor: { userId: string; isAdministrator: boolean };
};

export type RecordSignedAgreementResult = {
  agreementId: string;
  /** The held sale the agreement released into the next payout, when there was one. */
  releasedSellerTermsId: string | null;
  sellerNetPence: number | null;
};

/** The writes one recording makes, all in one transaction. */
export type SignedAgreementUnitOfWork = <T>(
  work: (ports: {
    agreements: ISignedAgreementWriter;
    sellerTerms: Pick<ISaleSellerTermsStore, "repriceHeld">;
    events: Pick<IDomainEventSink, "publish">;
  }) => Promise<T>,
) => Promise<T>;

export type RecordSignedAgreementDeps = {
  reader: IStaffLotSellerProceedsReader;
  uploads: IUploadObjectDescriber;
  unitOfWork: SignedAgreementUnitOfWork;
  /** The London calendar day, "2026-11-13". */
  today: () => string;
};

/** Midday London on the signing day, so the stored instant reads as that day in any zone. */
function signedAtFor(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

function invalid(errors: SignedAgreementErrors): never {
  throw new SellerProceedsError("invalid_agreement", 422, "Check the agreement's details.", errors);
}

/**
 * Records a seller's signed paper agreement against the lot's consignment so a held sale can be
 * paid: checks the fields, the signed PDF (its kind, type, size and that it has been validated) and
 * that recording is still needed, then in one transaction writes the agreement, prices the held
 * sale again with the one calculator (`sellerProceeds`) and writes the audit entry. An agreement
 * already on record is only replaced on purpose, by an Administrator.
 */
export class RecordSignedAgreementService {
  constructor(private readonly deps: RecordSignedAgreementDeps) {}

  async record(command: RecordSignedAgreementCommand): Promise<RecordSignedAgreementResult> {
    const errors = checkSignedAgreement(command, this.deps.today());
    if (Object.keys(errors).length > 0) invalid(errors);

    const facts = await this.deps.reader.forLot(command.lotId);
    if (!facts) throw new SellerProceedsError("lot_not_found", 404, "This lot no longer exists.");
    const sellerLegalEntityId = facts.sellerLegalEntityId;
    if (!sellerLegalEntityId) {
      throw new SellerProceedsError("no_seller", 409, "This lot has no seller to record it for.");
    }
    if (!facts.submissionId) {
      throw new SellerProceedsError(
        "no_consignment",
        409,
        "This lot wasn't consigned through LAX, so there is no consignment to keep the agreement with.",
      );
    }
    this.assertRecordingAllowed(facts, command);
    await this.assertSignedPdf(command.uploadObjectId, command.actor.userId);

    const commissionPercent = signedAgreementCommission(command.commissionPercent);
    const signedAt = signedAtFor(command.signedOn);
    const held =
      facts.sale?.terms?.basis === "held" && !facts.sale.payout ? facts.sale.terms : null;
    const submissionId = facts.submissionId;
    const uploadObjectId = command.uploadObjectId as string;

    return this.deps.unitOfWork(async ({ agreements, sellerTerms, events }) => {
      const recorded = await agreements.recordSigned({
        submissionId,
        legalEntityId: sellerLegalEntityId,
        commissionPercent,
        signedAt,
        signedDocumentId: uploadObjectId,
        reason: command.reason.trim(),
        recordedByUserId: command.actor.userId,
      });

      let releasedSellerTermsId: string | null = null;
      let sellerNetPence: number | null = null;
      if (held) {
        const snapshot = this.priced(facts, held, recorded.agreementId, commissionPercent);
        const stored = await sellerTerms.repriceHeld(held.id, snapshot, "agreement_recorded");
        if (stored.snapshot.basis === "agreement") {
          releasedSellerTermsId = stored.id;
          sellerNetPence = stored.snapshot.sellerNetPence;
        }
      }

      await events.publish({
        aggregateType: "lot",
        aggregateId: command.lotId,
        eventType: "lot.seller_agreement_recorded",
        actorUserId: command.actor.userId,
        schemaVersion: 1,
        payload: {
          lotId: command.lotId,
          submissionId,
          agreementId: recorded.agreementId,
          sellerLegalEntityId,
          commissionPercent,
          signedAt: signedAt.toISOString(),
          signedDocumentId: uploadObjectId,
          reason: command.reason.trim(),
          replace: command.replace,
          previousAgreement: recorded.replaced
            ? {
                agreementId: recorded.replaced.id,
                commissionPercent: recorded.replaced.commissionPercent,
                acceptedAt: recorded.replaced.acceptedAt?.toISOString() ?? null,
                source: recorded.replaced.source,
                signedDocumentId: recorded.replaced.signedDocumentId,
              }
            : null,
          releasedSellerTermsId,
          sellerNetPence,
        },
      });
      return { agreementId: recorded.agreementId, releasedSellerTermsId, sellerNetPence };
    });
  }

  /** Recording is for a sale that needs it; replacing a sound agreement is an Administrator's call. */
  private assertRecordingAllowed(
    facts: StaffLotSellerProceedsFacts,
    command: RecordSignedAgreementCommand,
  ): void {
    const agreement = facts.agreement;
    const sound =
      agreement !== null &&
      agreement.signedAt !== null &&
      agreement.legalEntityId === facts.sellerLegalEntityId &&
      commissionPercentToBps(agreement.commissionPercent) !== null;
    if (!sound) return;
    if (!command.replace) {
      throw new SellerProceedsError(
        "agreement_on_record",
        409,
        "A signed agreement is already on record for this lot.",
      );
    }
    if (!command.actor.isAdministrator) {
      throw new SellerProceedsError(
        "replace_needs_administrator",
        403,
        "Only an Administrator can replace a signed agreement.",
      );
    }
  }

  private async assertSignedPdf(uploadObjectId: string | null, userId: string): Promise<void> {
    if (!uploadObjectId) invalid({ document: SIGNED_AGREEMENT_MESSAGES.document });
    const upload = await this.deps.uploads.describe(uploadObjectId);
    const usable =
      upload !== null &&
      upload.kind === SIGNED_AGREEMENT_UPLOAD_KIND &&
      upload.ownerUserId === userId &&
      upload.contentType === "application/pdf" &&
      upload.byteSize <= SIGNED_AGREEMENT_MAX_BYTES;
    if (!usable) invalid({ document: SIGNED_AGREEMENT_MESSAGES.document });
    if (upload.status !== "active") {
      throw new SellerProceedsError(
        "document_not_ready",
        409,
        "The signed agreement is still being checked. Try again in a moment.",
      );
    }
  }

  /** The held sale priced on the recorded agreement, by the one calculator. */
  private priced(
    facts: StaffLotSellerProceedsFacts,
    held: NonNullable<NonNullable<StaffLotSellerProceedsFacts["sale"]>["terms"]>,
    agreementId: string,
    commissionPercent: string,
  ): SellerTermsSnapshot {
    const base = {
      lotId: facts.lotId,
      sellerLegalEntityId: facts.sellerLegalEntityId as string,
      hammerPence: held.hammerPence,
      premiumPence: held.premiumPence,
      ruleVersion: SELLER_RULE_VERSION,
    };
    const commissionBps = commissionPercentToBps(commissionPercent);
    if (commissionBps === null) return { ...base, basis: "held", heldReason: "no_commission" };
    const proceeds = sellerProceeds({
      hammerPence: held.hammerPence,
      party: { kind: "agreement", commissionBps },
      vat: facts.vatSetting,
    });
    if (proceeds.basis === "held") return { ...base, basis: "held", heldReason: proceeds.reason };
    if (proceeds.basis === "lax_owned") return { ...base, basis: "lax_owned" };
    return {
      ...base,
      basis: "agreement",
      agreementId,
      commissionBps: proceeds.commissionBps,
      commissionPence: proceeds.commissionPence,
      commissionVatTreatment: proceeds.vatTreatment,
      commissionVatBps: proceeds.vatBps,
      commissionVatPence: proceeds.vatPence,
      otherCharges: proceeds.otherCharges,
      sellerNetPence: proceeds.netPence,
    };
  }
}

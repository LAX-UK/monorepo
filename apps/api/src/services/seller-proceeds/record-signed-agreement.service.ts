import {
  SELLER_RULE_VERSION,
  type SellerTermsHeldReason,
  type SellerTermsSnapshot,
  commissionPercentToBps,
  sellerProceeds,
} from "@auction/domain";
import {
  AgreementAlreadyRecordedError,
  type ISaleSellerTermsStore,
  type ISignedAgreementWriter,
  type IStaffLotSellerProceedsReader,
  type IUploadObjectDescriber,
  type LockedAgreement,
  SignedDocumentInUseError,
  type StaffLotSellerProceedsFacts,
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

/** Said on the file field when the PDF is already another lot's signed agreement. */
export const SIGNED_AGREEMENT_DOCUMENT_IN_USE =
  "This PDF is already recorded as another consignment's signed agreement. Upload this seller's own copy.";

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

/** What recording did to the lot's sale, decided under the locks a payout run takes. */
export type RecordedSaleOutcome =
  /** The held sale is priced on the agreement and joins the next payout. */
  | { kind: "released"; sellerTermsId: string; sellerNetPence: number }
  /** The sale is still held, for a reason recording did not fix (or the agreement leaves). */
  | { kind: "still_held"; reason: SellerTermsHeldReason }
  /** The sale was already on a payout: it was paid as it was priced. */
  | { kind: "already_paid" }
  /** The sale was already priced: it keeps the snapshot it was priced on. */
  | { kind: "already_priced" }
  /** The lot has no sale yet. */
  | { kind: "no_sale" };

export type RecordSignedAgreementResult = {
  agreementId: string;
  /** The held sale the agreement released into the next payout, when there was one. */
  releasedSellerTermsId: string | null;
  sellerNetPence: number | null;
  sale: RecordedSaleOutcome;
};

/** The writes one recording makes, all in one transaction, and the reads it decides from. */
export type SignedAgreementUnitOfWork = <T>(
  work: (ports: {
    /** The lot read again inside the transaction, after the seller's settlement lock. */
    facts: IStaffLotSellerProceedsReader;
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

const lotChanged = () =>
  new SellerProceedsError(
    "lot_changed",
    409,
    "This lot's seller or consignment changed while you were recording. Review it again.",
  );

type HeldTerms = NonNullable<NonNullable<StaffLotSellerProceedsFacts["sale"]>["terms"]>;

/**
 * Records a seller's signed paper agreement against the lot's consignment so a held sale can be
 * paid. The fields and the signed PDF (its kind, type, size and that it has been validated) are
 * checked first. Then, in one transaction and in the order a payout run takes them, it takes the
 * seller's settlement lock, the sale's payment and seller-terms rows and the agreement row, reads
 * the lot again and only then decides: whether recording is still needed or is a replacement
 * (an Administrator's call), whether the PDF is free to use, and whether the sale is still held.
 * It writes the agreement, prices a held sale again with the one calculator (`sellerProceeds`)
 * and writes the audit entry saying what happened to the sale.
 */
export class RecordSignedAgreementService {
  constructor(private readonly deps: RecordSignedAgreementDeps) {}

  async record(command: RecordSignedAgreementCommand): Promise<RecordSignedAgreementResult> {
    const errors = checkSignedAgreement(command, this.deps.today());
    if (Object.keys(errors).length > 0) invalid(errors);

    const before = await this.deps.reader.forLot(command.lotId);
    if (!before) throw new SellerProceedsError("lot_not_found", 404, "This lot no longer exists.");
    const sellerLegalEntityId = before.sellerLegalEntityId;
    if (!sellerLegalEntityId) {
      throw new SellerProceedsError("no_seller", 409, "This lot has no seller to record it for.");
    }
    if (!before.submissionId) {
      throw new SellerProceedsError(
        "no_consignment",
        409,
        "This lot wasn't consigned through LAX, so there is no consignment to keep the agreement with.",
      );
    }
    await this.assertSignedPdf(command.uploadObjectId, command.actor.userId);

    const commissionPercent = signedAgreementCommission(command.commissionPercent);
    const signedAt = signedAtFor(command.signedOn);
    const submissionId = before.submissionId;
    const uploadObjectId = command.uploadObjectId as string;

    try {
      return await this.deps.unitOfWork(async ({ facts, agreements, sellerTerms, events }) => {
        // The run's order: the seller's settlement lock, the payment, its seller terms.
        await agreements.lockSettlement(sellerLegalEntityId);
        const locked = await facts.forLot(command.lotId);
        if (!locked) {
          throw new SellerProceedsError("lot_not_found", 404, "This lot no longer exists.");
        }
        if (
          locked.sellerLegalEntityId !== sellerLegalEntityId ||
          locked.submissionId !== submissionId
        ) {
          throw lotChanged();
        }
        if (locked.sale) {
          await agreements.lockSale({
            paymentId: locked.sale.paymentId,
            sellerTermsId: locked.sale.terms?.id ?? null,
          });
        }
        const current = await agreements.lockAgreement(submissionId);
        this.assertRecordingAllowed(current, sellerLegalEntityId, command);
        await agreements.claimDocument(uploadObjectId, submissionId);
        // Read once more with every row held, so nothing the decision rests on can move.
        const now = (await facts.forLot(command.lotId)) ?? locked;
        const sale = now.sale;
        const held: HeldTerms | null =
          sale?.terms?.basis === "held" && !sale.payout ? sale.terms : null;

        const recorded = await agreements.recordSigned({
          submissionId,
          legalEntityId: sellerLegalEntityId,
          commissionPercent,
          signedAt,
          signedDocumentId: uploadObjectId,
          reason: command.reason.trim(),
          recordedByUserId: command.actor.userId,
        });

        let outcome: RecordedSaleOutcome;
        if (held) {
          const snapshot = this.priced(now, held, recorded.agreementId, commissionPercent);
          const stored = await sellerTerms.repriceHeld(held.id, snapshot, "agreement_recorded");
          outcome =
            stored.snapshot.basis === "agreement"
              ? {
                  kind: "released",
                  sellerTermsId: stored.id,
                  sellerNetPence: stored.snapshot.sellerNetPence,
                }
              : stored.snapshot.basis === "held"
                ? { kind: "still_held", reason: stored.snapshot.heldReason }
                : { kind: "already_priced" };
        } else if (!sale) {
          outcome = { kind: "no_sale" };
        } else if (sale.payout) {
          outcome = { kind: "already_paid" };
        } else if (sale.terms?.basis === "held") {
          outcome = { kind: "still_held", reason: sale.terms.heldReason ?? "no_agreement" };
        } else {
          outcome = { kind: "already_priced" };
        }
        const releasedSellerTermsId = outcome.kind === "released" ? outcome.sellerTermsId : null;
        const sellerNetPence = outcome.kind === "released" ? outcome.sellerNetPence : null;

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
            saleOutcome: outcome.kind,
            heldReason: outcome.kind === "still_held" ? outcome.reason : null,
            releasedSellerTermsId,
            sellerNetPence,
          },
        });
        return {
          agreementId: recorded.agreementId,
          releasedSellerTermsId,
          sellerNetPence,
          sale: outcome,
        };
      });
    } catch (err) {
      if (err instanceof AgreementAlreadyRecordedError) {
        throw new SellerProceedsError(
          "agreement_on_record",
          409,
          "A signed agreement is already on record for this lot.",
        );
      }
      if (err instanceof SignedDocumentInUseError) {
        invalid({ document: SIGNED_AGREEMENT_DOCUMENT_IN_USE });
      }
      throw err;
    }
  }

  /** Recording is for a sale that needs it; replacing a sound agreement is an Administrator's call. */
  private assertRecordingAllowed(
    agreement: LockedAgreement | null,
    sellerLegalEntityId: string,
    command: RecordSignedAgreementCommand,
  ): void {
    const sound =
      agreement !== null &&
      agreement.acceptedAt !== null &&
      agreement.legalEntityId === sellerLegalEntityId &&
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
    held: HeldTerms,
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

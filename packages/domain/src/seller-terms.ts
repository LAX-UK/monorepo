import {
  type CommissionVatTreatment,
  type OtherCharge,
  SELLER_RULE_VERSION,
  commissionPercentToBps,
  sellerProceeds,
} from "./seller-proceeds.js";

/** Why a sale is held: the facts the rule needs are missing or unusable. Each one has its own fix. */
export type SellerTermsHeldReason =
  | "no_agreement"
  | "not_accepted"
  | "no_commission"
  | "other_seller"
  | "vat_setting_missing"
  | "negative_net";

/** What was known about a sale when its buyer's invoice was raised. */
type SnapshotBase = {
  readonly lotId: string;
  readonly sellerLegalEntityId: string;
  /** From the invoice's stored lines, never from the live lot. */
  readonly hammerPence: number;
  readonly premiumPence: number;
  readonly ruleVersion: typeof SELLER_RULE_VERSION;
};

/**
 * The seller-terms snapshot: the agreement, the rate and the amounts in pence, fixed once when the
 * invoice is raised. Settlement pays from it, so a later change to an agreement or a setting
 * never moves a sale that has been priced.
 */
export type SellerTermsSnapshot =
  | (SnapshotBase & {
      readonly basis: "agreement";
      readonly agreementId: string;
      readonly commissionBps: number;
      readonly commissionPence: number;
      readonly commissionVatTreatment: CommissionVatTreatment;
      readonly commissionVatBps: number;
      readonly commissionVatPence: number;
      readonly otherCharges: readonly OtherCharge[];
      readonly sellerNetPence: number;
    })
  | (SnapshotBase & { readonly basis: "lax_owned" })
  | (SnapshotBase & { readonly basis: "held"; readonly heldReason: SellerTermsHeldReason });

/** The consignment agreement found for a lot, as the rule reads it. */
export type AgreementFacts = {
  readonly id: string;
  /** The account the agreement was made with. */
  readonly legalEntityId: string;
  readonly acceptedAt: Date | null;
  /** As stored: a percentage with up to two decimals, or null when blank. */
  readonly commissionPercent: string | null;
};

/** Reads the facts about a lot's seller. Infrastructure sits behind this port. */
export interface ISellerTermsFacts {
  /** Whether the seller account is LAX's own stock. */
  isLaxOwned(sellerLegalEntityId: string): Promise<boolean>;
  /**
   * The agreement of the submission the lot came from (lot, then the submission converted into it,
   * then that submission's agreement), or `null` when there is none.
   */
  agreementForLot(lotId: string): Promise<AgreementFacts | null>;
}

/** Reads the Bid company's VAT setting. `null` means it has not been set. */
export interface ICommissionVatSettingReader {
  read(): Promise<CommissionVatTreatment | null>;
}

export type SellerTermsRequest = {
  lotId: string;
  sellerLegalEntityId: string;
  hammerPence: number;
  premiumPence: number;
};

export interface ISellerTermsPolicy {
  /** The terms a sale is paid on, or the reason it is held. Never falls back to a default rate. */
  snapshotFor(request: SellerTermsRequest): Promise<SellerTermsSnapshot>;
}

/**
 * Resolves the seller's terms for a sale: lot, submission, accepted agreement of the same seller
 * with a commission, then the one calculator. When a fact is missing the sale is held with the
 * reason, never priced on a guessed rate.
 */
export class SellerTermsPolicy implements ISellerTermsPolicy {
  constructor(
    private readonly facts: ISellerTermsFacts,
    private readonly vatSetting: ICommissionVatSettingReader,
  ) {}

  async snapshotFor(request: SellerTermsRequest): Promise<SellerTermsSnapshot> {
    const base: SnapshotBase = {
      lotId: request.lotId,
      sellerLegalEntityId: request.sellerLegalEntityId,
      hammerPence: request.hammerPence,
      premiumPence: request.premiumPence,
      ruleVersion: SELLER_RULE_VERSION,
    };
    const held = (heldReason: SellerTermsHeldReason): SellerTermsSnapshot => ({
      ...base,
      basis: "held",
      heldReason,
    });

    if (await this.facts.isLaxOwned(request.sellerLegalEntityId)) {
      return { ...base, basis: "lax_owned" };
    }

    const agreement = await this.facts.agreementForLot(request.lotId);
    if (!agreement) return held("no_agreement");
    if (agreement.legalEntityId !== request.sellerLegalEntityId) return held("other_seller");
    if (!agreement.acceptedAt) return held("not_accepted");
    const commissionBps = commissionPercentToBps(agreement.commissionPercent);
    if (commissionBps === null) return held("no_commission");

    const proceeds = sellerProceeds({
      hammerPence: request.hammerPence,
      party: { kind: "agreement", commissionBps },
      vat: await this.vatSetting.read(),
    });
    if (proceeds.basis === "held") return held(proceeds.reason);
    if (proceeds.basis === "lax_owned") return { ...base, basis: "lax_owned" };
    return {
      ...base,
      basis: "agreement",
      agreementId: agreement.id,
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

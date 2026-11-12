import {
  type Pence,
  STANDARD_VAT_RATE_BPS,
  type VatTreatment,
  vatForLine,
} from "@auction/accounting-domain";

/** The rule every seller figure follows: the signed agreement's commission, on the hammer, plus VAT. */
export const SELLER_RULE_VERSION = "agreement_hammer_v1" as const;

/** The most a commission rate can be, in basis points (100%). */
export const MAX_COMMISSION_BPS = 10_000;

/**
 * Whether the Bid company charges VAT on the commission it takes. One setting for the whole
 * company, never guessed: when it is missing, sales are held rather than paid on an assumption.
 */
export type CommissionVatTreatment = "standard" | "not_registered";

/** Who the sale's proceeds belong to, and the commission that applies when they are a seller's. */
export type SellerProceedsParty =
  | { readonly kind: "lax_owned" }
  | { readonly kind: "agreement"; readonly commissionBps: number };

export type SellerProceedsInput = {
  /** What the lot sold for, in whole pence. The buyer's premium is never part of the seller's side. */
  readonly hammerPence: Pence;
  readonly party: SellerProceedsParty;
  /** The Bid company's VAT setting, or `null` when it has not been set. */
  readonly vat: CommissionVatTreatment | null;
};

/** Why a sale's proceeds cannot be worked out yet. */
export type SellerProceedsHeldReason = "vat_setting_missing" | "negative_net";

/** Charges beyond commission and VAT. None exist today; the shape is kept so they can be added. */
export type OtherCharge = { readonly label: string; readonly pence: Pence };

export type SellerProceeds =
  | {
      readonly basis: "agreement";
      readonly hammerPence: Pence;
      readonly commissionBps: number;
      readonly commissionPence: Pence;
      readonly vatTreatment: CommissionVatTreatment;
      readonly vatBps: number;
      readonly vatPence: Pence;
      readonly otherCharges: readonly OtherCharge[];
      /** What the seller receives: the hammer less commission, VAT on it and other charges. */
      readonly netPence: Pence;
    }
  | {
      /** The seller account is LAX's own stock: the whole sale is LAX's and nothing is paid out. */
      readonly basis: "lax_owned";
      readonly hammerPence: Pence;
      readonly netPence: 0;
    }
  | {
      readonly basis: "held";
      readonly reason: SellerProceedsHeldReason;
      readonly hammerPence: Pence;
    };

/** The commission on a hammer, rounded half-up to the penny. */
function commissionOn(hammerPence: Pence, commissionBps: number): Pence {
  // floor((hammer * bps + 5000) / 10000) is half-up for non-negative integers, with no float step.
  return Math.floor((hammerPence * commissionBps + 5000) / 10_000);
}

/** The treatment accounting uses for each setting: "not registered" is outside the scope of VAT. */
const ACCOUNTING_TREATMENT: Record<CommissionVatTreatment, VatTreatment> = {
  standard: "standard",
  not_registered: "outside_scope",
};

const VAT_RATE_BPS: Record<CommissionVatTreatment, number> = {
  standard: STANDARD_VAT_RATE_BPS,
  not_registered: 0,
};

/** Largest hammer the rule works on: keeps hammer × rate inside safe integers. */
const MAX_HAMMER_PENCE = 100_000_000_000;

function assertWholePence(value: number, what: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_HAMMER_PENCE) {
    throw new RangeError(`${what} must be whole, non-negative pence up to £1bn`);
  }
}

/**
 * What the seller of one lot receives. The one place this sum is made: settlement, the staff
 * screens, the seller's pages, the re-offer estimate and Books all read this result.
 *
 * Integer pence, per lot, half-up, in the order commission, then VAT on that commission, then net.
 * Commission is charged on the hammer only (never on the buyer's premium), VAT is charged on the
 * commission, and `net = hammer - commission - VAT`. A sale whose VAT setting is missing, or whose
 * deductions pass the hammer, is held rather than paid on a guess. LAX-owned stock has no
 * commission and no payout.
 */
export function sellerProceeds(input: SellerProceedsInput): SellerProceeds {
  const { hammerPence, party, vat } = input;
  assertWholePence(hammerPence, "hammer");
  if (party.kind === "lax_owned") return { basis: "lax_owned", hammerPence, netPence: 0 };

  const { commissionBps } = party;
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > MAX_COMMISSION_BPS) {
    throw new RangeError("commission must be whole basis points between 0 and 10000");
  }
  if (vat === null) return { basis: "held", reason: "vat_setting_missing", hammerPence };

  const commissionPence = commissionOn(hammerPence, commissionBps);
  const vatBps = VAT_RATE_BPS[vat];
  const charged = vatForLine(commissionPence, ACCOUNTING_TREATMENT[vat], vatBps);
  if (!charged.ok) throw new RangeError(charged.refusal.message);
  const vatPence = charged.value;
  const netPence = hammerPence - commissionPence - vatPence;
  if (netPence < 0) return { basis: "held", reason: "negative_net", hammerPence };

  return {
    basis: "agreement",
    hammerPence,
    commissionBps,
    commissionPence,
    vatTreatment: vat,
    vatBps,
    vatPence,
    otherCharges: [],
    netPence,
  };
}

/**
 * A commission as an agreement stores it (a percentage with up to two decimals, "12.50") in whole
 * basis points, exactly and with no float step. Anything that is not a rate from 0 to 100 is `null`.
 */
export function commissionPercentToBps(percent: string | null): number | null {
  if (percent === null) return null;
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(percent.trim());
  if (!match) return null;
  const bps = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || 0);
  return bps <= MAX_COMMISSION_BPS ? bps : null;
}

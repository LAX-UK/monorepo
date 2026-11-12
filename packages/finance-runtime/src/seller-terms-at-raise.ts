import {
  type ICommissionVatSettingReader,
  type ISellerTermsFacts,
  type ISellerTermsPolicy,
  SELLER_RULE_VERSION,
  SellerTermsPolicy,
  type SellerTermsSnapshot,
} from "@auction/domain";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { InvoiceInvariantError, type PricedInvoice } from "./invoice-raiser.js";
import { type IPlatformFeePolicy, PlatformFeePolicy } from "./platform-fee.policy.js";

/** What a payment is raised with on the seller's side. */
export type SellerTermsAtRaise = {
  /** The seller's terms for the sale, stored with the payment. */
  sellerTerms: SellerTermsSnapshot;
  /**
   * The payment's `platform_fee` in major units. Settlement still reads it until it pays from the
   * terms, so it keeps the figure it always had; it is not part of the terms.
   */
  platformFee: string;
};

export interface ISellerTermsAtRaise {
  forInvoice(input: {
    lot: Pick<Lot, "id" | "sellerLegalEntityId">;
    priced: Pick<PricedInvoice, "lines" | "totalPence">;
  }): Promise<SellerTermsAtRaise>;
}

/**
 * The hammer and the buyer's premium of an invoice, from its stored lines, or `null` when the
 * invoice has no hammer line (a pre-itemisation invoice stored as one `legacy_total` line). The
 * caller decides what that means; nothing here guesses a hammer from the total.
 */
export function hammerAndPremiumOf(
  lines: readonly { kind: string; amountPence: number }[],
): { hammerPence: number; premiumPence: number } | null {
  if (!lines.some((line) => line.kind === "hammer")) return null;
  const sumOf = (kind: string) =>
    lines.filter((line) => line.kind === kind).reduce((total, line) => total + line.amountPence, 0);
  return { hammerPence: sumOf("hammer"), premiumPence: sumOf("buyers_premium") };
}

/**
 * The one way both payment-raising paths (checkout and lot end) get the seller's side: the terms
 * from the seller-terms policy, priced on the invoice's own hammer, and the payment's legacy fee.
 *
 * The agreement and the VAT setting are read here, before the raise transaction opens, not inside
 * it. The window is tiny, and the snapshot stored is exactly what was read, so a change landing in
 * between is simply picked up by the next sale; nothing stored disagrees with itself.
 */
export class SellerTermsAtRaiseService implements ISellerTermsAtRaise {
  constructor(
    private readonly policy: ISellerTermsPolicy,
    private readonly legacyFee: Pick<IPlatformFeePolicy, "computePlatformFeeFromPence">,
  ) {}

  async forInvoice(input: {
    lot: Pick<Lot, "id" | "sellerLegalEntityId">;
    priced: Pick<PricedInvoice, "lines" | "totalPence">;
  }): Promise<SellerTermsAtRaise> {
    const { lot, priced } = input;
    if (!lot.sellerLegalEntityId) {
      throw new InvoiceInvariantError("A lot needs its seller account to be invoiced");
    }
    const split = hammerAndPremiumOf(priced.lines);
    // A live invoice from before itemised invoices has no hammer line. Its payment is still
    // raised (what the buyer pays and the legacy fee need only the total); the seller's side is
    // held until staff price it, never guessed from the total.
    const sellerTerms: SellerTermsSnapshot = split
      ? await this.policy.snapshotFor({
          lotId: lot.id,
          sellerLegalEntityId: lot.sellerLegalEntityId,
          hammerPence: split.hammerPence,
          premiumPence: split.premiumPence,
        })
      : {
          lotId: lot.id,
          sellerLegalEntityId: lot.sellerLegalEntityId,
          hammerPence: 0,
          premiumPence: 0,
          ruleVersion: SELLER_RULE_VERSION,
          basis: "held",
          heldReason: "legacy_invoice",
        };
    const platformFee = await this.legacyFee.computePlatformFeeFromPence(
      lot.sellerLegalEntityId,
      priced.totalPence,
    );
    return { sellerTerms, platformFee };
  }
}

/**
 * The seller's side as the API and the worker raise it: the signed agreement's terms from the
 * readers given, and the payment's legacy fee from the seller account's platform fee. The
 * containers build the readers; nothing here touches the database.
 */
export function createSellerTermsAtRaise(deps: {
  facts: ISellerTermsFacts;
  vatSetting: ICommissionVatSettingReader;
  legalEntities: ILegalEntityRepository | null;
}): ISellerTermsAtRaise {
  return new SellerTermsAtRaiseService(
    new SellerTermsPolicy(deps.facts, deps.vatSetting),
    new PlatformFeePolicy(deps.legalEntities),
  );
}

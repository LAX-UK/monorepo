import {
  type ICommissionVatSettingReader,
  type ISellerTermsFacts,
  type ISellerTermsPolicy,
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

/** The hammer and the buyer's premium of an invoice, from its stored lines. */
export function hammerAndPremiumOf(lines: readonly { kind: string; amountPence: number }[]): {
  hammerPence: number;
  premiumPence: number;
} {
  const sumOf = (kind: string) =>
    lines.filter((line) => line.kind === kind).reduce((total, line) => total + line.amountPence, 0);
  if (!lines.some((line) => line.kind === "hammer")) {
    throw new InvoiceInvariantError(
      "The invoice has no hammer line, so the seller's side cannot be priced",
    );
  }
  return { hammerPence: sumOf("hammer"), premiumPence: sumOf("buyers_premium") };
}

/**
 * The one way both payment-raising paths (checkout and lot end) get the seller's side: the terms
 * from the seller-terms policy, priced on the invoice's own hammer, and the payment's legacy fee.
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
    const { hammerPence, premiumPence } = hammerAndPremiumOf(priced.lines);
    const sellerTerms = await this.policy.snapshotFor({
      lotId: lot.id,
      sellerLegalEntityId: lot.sellerLegalEntityId,
      hammerPence,
      premiumPence,
    });
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

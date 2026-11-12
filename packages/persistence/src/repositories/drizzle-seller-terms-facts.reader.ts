import type { Database } from "@auction/db";
import {
  bidFinanceSetting,
  consignmentAgreement,
  itemSubmission,
  legalEntity,
} from "@auction/db/schema";
import type {
  AgreementFacts,
  CommissionVatTreatment,
  ICommissionVatSettingReader,
  ISellerTermsFacts,
} from "@auction/domain";
import { and, desc, eq, sql } from "drizzle-orm";

/** The key of the Bid company's setting for VAT on commission. */
export const COMMISSION_VAT_SETTING_KEY = "commission_vat_treatment";

/**
 * Reads what the seller-terms rule needs to know about a sale: whether the seller account is LAX's
 * own stock, and the agreement of the submission the lot was made from.
 */
export class DrizzleSellerTermsFactsReader implements ISellerTermsFacts {
  constructor(private readonly db: Database) {}

  async isLaxOwned(sellerLegalEntityId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: legalEntity.id })
      .from(legalEntity)
      .where(and(eq(legalEntity.id, sellerLegalEntityId), eq(legalEntity.subkind, "lax_stock")))
      .limit(1);
    return row !== undefined;
  }

  async agreementForLot(lotId: string): Promise<AgreementFacts | null> {
    const [row] = await this.db
      .select({
        id: consignmentAgreement.id,
        legalEntityId: consignmentAgreement.legalEntityId,
        acceptedAt: consignmentAgreement.acceptedAt,
        commissionPercent: consignmentAgreement.commissionPercent,
      })
      .from(itemSubmission)
      .innerJoin(consignmentAgreement, eq(consignmentAgreement.submissionId, itemSubmission.id))
      .where(eq(itemSubmission.convertedLotId, lotId))
      // An accepted agreement wins; among several, the most recently accepted.
      .orderBy(
        sql`${consignmentAgreement.acceptedAt} is null`,
        desc(consignmentAgreement.acceptedAt),
        desc(consignmentAgreement.proposedAt),
      )
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      legalEntityId: row.legalEntityId,
      acceptedAt: row.acceptedAt ?? null,
      commissionPercent: row.commissionPercent === null ? null : String(row.commissionPercent),
    };
  }
}

/** Reads whether the Bid company charges VAT on commission. No row means it has not been set. */
export class DrizzleCommissionVatSettingReader implements ICommissionVatSettingReader {
  constructor(private readonly db: Database) {}

  async read(): Promise<CommissionVatTreatment | null> {
    const [row] = await this.db
      .select({ value: bidFinanceSetting.value })
      .from(bidFinanceSetting)
      .where(eq(bidFinanceSetting.key, COMMISSION_VAT_SETTING_KEY))
      .limit(1);
    return row?.value === "standard" || row?.value === "not_registered" ? row.value : null;
  }
}

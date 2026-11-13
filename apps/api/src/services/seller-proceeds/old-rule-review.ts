import {
  type CommissionVatTreatment,
  commissionPercentToBps,
  parseMoneyToMinorUnits,
  sellerProceeds,
} from "@auction/domain";
import type { StaffOldRuleSale } from "@auction/persistence/interfaces";

/** What the seller's agreement would have given for a sale paid under the old rule. */
export type AgreementGives =
  | {
      kind: "priced";
      commissionBps: number;
      commissionPence: number;
      commissionVatPence: number;
      netPence: number;
    }
  /** Why no figure can be given: nothing to price it from. */
  | {
      kind: "unpriced";
      reason:
        | "no_hammer"
        | "no_agreement"
        | "no_commission"
        | "vat_setting_missing"
        | "negative_net";
    };

export type OldRuleReviewRow = StaffOldRuleSale & {
  /** What the seller was paid for the sale: the buyer's payment less the old fee. */
  paidNetPence: number;
  agreementGives: AgreementGives;
  /** Agreement figure less what was paid; positive means the seller was paid less. */
  differencePence: number | null;
};

const pence = (pounds: string) => Number(parseMoneyToMinorUnits(pounds));

/**
 * One old-rule sale beside what its signed agreement gives, priced by the one calculator. Read
 * only: nothing here changes a payout; finance decides each one.
 */
export function oldRuleReviewRow(
  row: StaffOldRuleSale,
  vat: CommissionVatTreatment | null,
): OldRuleReviewRow {
  const paidNetPence = pence(row.paymentAmount) - pence(row.platformFee);
  const unpriced = (reason: Extract<AgreementGives, { kind: "unpriced" }>["reason"]) => ({
    ...row,
    paidNetPence,
    agreementGives: { kind: "unpriced", reason } as const,
    differencePence: null,
  });
  if (row.hammerPence === null) return unpriced("no_hammer");
  if (!row.agreement) return unpriced("no_agreement");
  const commissionBps = commissionPercentToBps(row.agreement.commissionPercent);
  if (commissionBps === null) return unpriced("no_commission");
  const proceeds = sellerProceeds({
    hammerPence: row.hammerPence,
    party: { kind: "agreement", commissionBps },
    vat,
  });
  if (proceeds.basis === "held") return unpriced(proceeds.reason);
  if (proceeds.basis !== "agreement") return unpriced("no_agreement");
  return {
    ...row,
    paidNetPence,
    agreementGives: {
      kind: "priced",
      commissionBps,
      commissionPence: proceeds.commissionPence,
      commissionVatPence: proceeds.vatPence,
      netPence: proceeds.netPence,
    },
    differencePence: proceeds.netPence - paidNetPence,
  };
}

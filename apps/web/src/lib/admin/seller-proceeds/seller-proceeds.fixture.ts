import type { AdminSettlementPreview } from "@/lib/data/http/admin-payouts.shared";
import type {
  LotSellerProceedsDto,
  OldRuleRowDto,
  PayoutSalesDto,
  SellerTermsDto,
  SettlementPreviewDealDto,
  SettlementPreviewSaleDto,
} from "@/lib/data/http/admin-seller-proceeds.shared";

/**
 * Fixture sales for tests and the review screenshots: invented lots, sellers and figures.
 * Lot 21 sold for £6,200 with a 25% premium; the agreement charges 12% plus VAT.
 */
export const FIXTURE_TERMS: SellerTermsDto = {
  id: "00000000-0000-4000-8000-0000000000a1",
  basis: "agreement",
  heldReason: null,
  source: "raised",
  hammerPence: 620_000,
  premiumPence: 155_000,
  commissionBps: 1200,
  commissionPence: 74_400,
  commissionVatTreatment: "standard",
  commissionVatBps: 2000,
  commissionVatPence: 14_880,
  sellerNetPence: 530_720,
  legacyPlatformFeePence: null,
  computedAt: "2026-11-12T04:49:00.000Z",
};

export const FIXTURE_HELD_TERMS: SellerTermsDto = {
  ...FIXTURE_TERMS,
  basis: "held",
  heldReason: "no_agreement",
  commissionBps: null,
  commissionPence: null,
  commissionVatTreatment: null,
  commissionVatBps: null,
  commissionVatPence: null,
  sellerNetPence: null,
};

type SaleDto = NonNullable<LotSellerProceedsDto["sale"]>;

export function fixtureLotProceeds(
  over: Omit<Partial<LotSellerProceedsDto>, "sale"> & { sale?: Partial<SaleDto> | null } = {},
): LotSellerProceedsDto {
  const { sale: saleOver, ...rest } = over;
  const sale: SaleDto = {
    paymentId: "00000000-0000-4000-8000-0000000000b1",
    paymentStatus: "captured",
    terms: FIXTURE_TERMS,
    invoice: { totalPence: 775_000, premiumPence: 155_000, premiumRatePercent: "25.000" },
    payout: null,
    refundedAfterPayout: false,
    reawarded: false,
    ...(saleOver ?? {}),
  };
  return {
    lotId: "00000000-0000-4000-8000-0000000000c1",
    lotNumber: 21,
    lotTitle: "The Lock Keeper's House",
    sellerLegalEntityId: "00000000-0000-4000-8000-0000000000d1",
    sellerName: "Northbank Gallery Ltd",
    soldOnAtg: false,
    settledOutsideAt: null,
    sale: saleOver === null ? null : sale,
    agreement: {
      id: "00000000-0000-4000-8000-0000000000e1",
      reference: "C-1042",
      submissionId: "00000000-0000-4000-8000-0000000000f1",
      signedAt: "2026-10-03T10:00:00.000Z",
      source: "online",
    },
    submissionId: "00000000-0000-4000-8000-0000000000f1",
    vatSetting: "standard",
    ...rest,
  };
}

const agreement = (reference: string, n: number) => ({
  reference,
  submissionId: `00000000-0000-4000-8000-00000000010${n}`,
  signedAt: "2026-10-03T10:00:00.000Z",
  source: "online" as const,
});

/** Northbank Gallery Ltd's waiting sales: three ready, Lot 21 held. Net £72,228.50. */
export const FIXTURE_PREVIEW_SALES: SettlementPreviewSaleDto[] = [
  {
    kind: "ready",
    paymentId: "pay-a",
    lotId: "00000000-0000-4000-8000-000000000201",
    lotNumber: 7,
    lotTitle: "Estuary in Winter",
    agreement: agreement("C-1031", 1),
    hammerPence: 4_000_000,
    commissionBps: 1000,
    commissionPence: 400_000,
    commissionVatTreatment: "standard",
    commissionVatBps: 2000,
    commissionVatPence: 80_000,
    refundChargePence: 0,
    netPence: 3_520_000,
  },
  {
    kind: "ready",
    paymentId: "pay-b",
    lotId: "00000000-0000-4000-8000-000000000202",
    lotNumber: 12,
    lotTitle: "Harbour at Dusk",
    agreement: agreement("C-1042", 2),
    hammerPence: 2_500_000,
    commissionBps: 1200,
    commissionPence: 300_000,
    commissionVatTreatment: "standard",
    commissionVatBps: 2000,
    commissionVatPence: 60_000,
    refundChargePence: 0,
    netPence: 2_140_000,
  },
  {
    kind: "ready",
    paymentId: "pay-c",
    lotId: "00000000-0000-4000-8000-000000000203",
    lotNumber: 18,
    lotTitle: "Study of Reeds",
    agreement: { ...agreement("C-1047", 3), source: "recorded" },
    hammerPence: 1_775_966,
    commissionBps: 1000,
    commissionPence: 177_597,
    commissionVatTreatment: "standard",
    commissionVatBps: 2000,
    commissionVatPence: 35_519,
    refundChargePence: 0,
    netPence: 1_562_850,
  },
  {
    kind: "held",
    paymentId: "pay-d",
    lotId: "00000000-0000-4000-8000-0000000000c1",
    lotNumber: 21,
    lotTitle: "The Lock Keeper's House",
    agreement: null,
    reason: "no_agreement",
    hammerPence: 620_000,
  },
];

/** A released private sale the run pays beside the lots: £18,000, 12% commission, £150 costs. */
export const FIXTURE_PREVIEW_DEALS: SettlementPreviewDealDto[] = [
  {
    dealId: "00000000-0000-4000-8000-0000000004d1",
    reference: "PS-2026-0042",
    pricePence: 1_800_000,
    commissionPence: 216_000,
    costsPence: 15_000,
    netPence: 1_569_000,
  },
];

/** The totals as the API sends them: its ready lines and deals added up (the API's job, here). */
function apiTotals(
  sales: readonly SettlementPreviewSaleDto[],
  deals: readonly SettlementPreviewDealDto[],
) {
  const totals = {
    hammerPence: 0,
    commissionPence: 0,
    commissionVatPence: 0,
    refundChargePence: 0,
    dealsNetPence: 0,
    netPence: 0,
  };
  for (const sale of sales) {
    if (sale.kind !== "ready") continue;
    totals.hammerPence += sale.hammerPence;
    totals.commissionPence += sale.commissionPence;
    totals.commissionVatPence += sale.commissionVatPence;
    totals.refundChargePence += sale.refundChargePence;
    totals.netPence += sale.netPence;
  }
  for (const deal of deals) {
    totals.dealsNetPence += deal.netPence;
    totals.netPence += deal.netPence;
  }
  return totals;
}

export function fixtureSettlementPreview(
  sales: SettlementPreviewSaleDto[] = FIXTURE_PREVIEW_SALES,
  over: Partial<AdminSettlementPreview> = {},
  deals: SettlementPreviewDealDto[] = [],
): AdminSettlementPreview {
  return {
    pending: {
      pendingGross: "0.00",
      pendingPlatformFee: "0.00",
      pendingNet: "0.00",
      paymentCount: sales.filter((sale) => sale.kind === "ready").length,
      currency: "GBP",
      sales,
      deals,
      totals: apiTotals(sales, deals),
    },
    openPayout: null,
    ...over,
  };
}

/** A payout paid under the signed agreement: Lots 7, 12 and 18; Lot 21 held. */
export const FIXTURE_PAYOUT_SALES: PayoutSalesDto = {
  payout: {
    id: "00000000-0000-4000-8000-000000000301",
    legalEntityId: "00000000-0000-4000-8000-0000000000d1",
    status: "paid",
    createdAt: "2026-11-12T04:49:00.000Z",
    processedAt: "2026-11-13T09:00:00.000Z",
    grossAmount: "82759.66",
    platformFee: "10531.16",
    stripeFee: "0.00",
    netAmount: "72228.50",
    hammerAmount: "82759.66",
    commissionAmount: "8775.97",
    commissionVatAmount: "1755.19",
  },
  sales: FIXTURE_PREVIEW_SALES.flatMap((sale, i) =>
    sale.kind === "ready"
      ? [
          {
            lineId: `line-${i}`,
            paymentId: sale.paymentId,
            lotId: sale.lotId,
            lotNumber: sale.lotNumber,
            lotTitle: sale.lotTitle ?? "",
            amount: (sale.hammerPence / 100).toFixed(2),
            terms: {
              hammerPence: sale.hammerPence,
              commissionBps: sale.commissionBps,
              commissionPence: sale.commissionPence,
              commissionVatTreatment: sale.commissionVatTreatment,
              commissionVatBps: sale.commissionVatBps,
              commissionVatPence: sale.commissionVatPence,
              sellerNetPence: sale.netPence,
            },
            oldRule: null,
            agreement: sale.agreement && { ...sale.agreement, commissionPercent: null },
          },
        ]
      : [],
  ),
  heldForSeller: [
    {
      paymentId: "pay-d",
      sellerLegalEntityId: "00000000-0000-4000-8000-0000000000d1",
      sellerName: "Northbank Gallery Ltd",
      lotId: "00000000-0000-4000-8000-0000000000c1",
      lotNumber: 21,
      lotTitle: "The Lock Keeper's House",
      heldReason: "no_agreement",
      hammerPence: 620_000,
    },
  ],
};

/** A payout paid before the rule: the buyer's payment less the old 5% fee. */
export const FIXTURE_OLD_RULE_PAYOUT_SALES: PayoutSalesDto = {
  payout: {
    ...FIXTURE_PAYOUT_SALES.payout,
    id: "00000000-0000-4000-8000-000000000302",
    createdAt: "2026-09-30T09:00:00.000Z",
    processedAt: "2026-10-01T09:00:00.000Z",
    grossAmount: "1250.00",
    platformFee: "62.50",
    netAmount: "1187.50",
    hammerAmount: null,
    commissionAmount: null,
    commissionVatAmount: null,
  },
  sales: [
    {
      lineId: "line-old",
      paymentId: "pay-old",
      lotId: "00000000-0000-4000-8000-000000000204",
      lotNumber: 3,
      lotTitle: "Lamplight, Bankside",
      amount: "1250.00",
      terms: null,
      oldRule: { paymentAmount: "1250.00", platformFee: "62.50" },
      agreement: {
        reference: "C-0988",
        submissionId: "00000000-0000-4000-8000-000000000109",
        signedAt: "2026-08-01T10:00:00.000Z",
        source: "online",
        commissionPercent: "12.00",
      },
    },
  ],
  heldForSeller: [],
};

export const FIXTURE_OLD_RULE_ROWS: OldRuleRowDto[] = [
  {
    lineId: "line-old",
    payoutId: "00000000-0000-4000-8000-000000000302",
    payoutCreatedAt: "2026-09-30T09:00:00.000Z",
    paidAt: "2026-10-01T09:00:00.000Z",
    legalEntityId: "00000000-0000-4000-8000-0000000000d1",
    sellerName: "Northbank Gallery Ltd",
    lotId: "00000000-0000-4000-8000-000000000204",
    lotNumber: 3,
    lotTitle: "Lamplight, Bankside",
    paymentAmount: "1250.00",
    platformFee: "62.50",
    hammerPence: 100_000,
    agreement: FIXTURE_OLD_RULE_PAYOUT_SALES.sales[0]?.agreement ?? null,
    paidNetPence: 118_750,
    agreementGives: {
      kind: "priced",
      commissionBps: 1200,
      commissionPence: 12_000,
      commissionVatPence: 2_400,
      netPence: 85_600,
    },
    differencePence: -33_150,
  },
  {
    lineId: "line-old-2",
    payoutId: "00000000-0000-4000-8000-000000000303",
    payoutCreatedAt: "2026-09-15T09:00:00.000Z",
    paidAt: "2026-09-16T09:00:00.000Z",
    legalEntityId: "00000000-0000-4000-8000-0000000000d2",
    sellerName: "Marlowe Prints",
    lotId: "00000000-0000-4000-8000-000000000205",
    lotNumber: 9,
    lotTitle: "Wharf Cranes",
    paymentAmount: "500.00",
    platformFee: "25.00",
    hammerPence: 40_000,
    agreement: null,
    paidNetPence: 47_500,
    agreementGives: { kind: "unpriced", reason: "no_agreement" },
    differencePence: null,
  },
];

import { buildLotConditionReportViewModel } from "@/lib/condition-report/build-lot-condition-report-vm";
import type { LotPageShellData } from "@/lib/marketing/lot-page-data.service";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

const baseLot: Lot = {
  id: "lot-1",
  saleId: "sale-1",
  lotNumber: 7,
  sellerId: "seller-1",
  title: "Untitled Study",
  description: null,
  medium: "Oil on canvas",
  dimensions: null,
  images: ["https://cdn/lot.jpg"],
  categoryId: "cat-1",
  auctionType: "english",
  startingPrice: "100",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "450",
  buyerPremiumRate: "0.25",
  minBidIncrement: "10",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 60_000,
  dutchLastDecrementAt: null,
  startTime: new Date("2026-06-01T18:00:00Z"),
  endTime: new Date("2026-06-01T21:00:00Z"),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
};

describe("buildLotConditionReportViewModel", () => {
  it("shows the request CTA for online live lots with eligible session", () => {
    const vm = buildLotConditionReportViewModel({
      auction: baseLot,
      session: {
        id: "user-1",
        email: "buyer@example.com",
        emailVerified: true,
        kycStatus: "approved",
      } as LotPageShellData["session"],
      saleDeliveryMode: "online",
      auctionStatus: "active",
      kycSummary: null,
      kycUnavailable: false,
      kycFeedbackDto: null,
      loginNextPath: "/lot/lot-1",
      canParticipate: true,
      publishedConditionReport: null,
      buyerConditionReportRequest: null,
    });

    expect(vm.session.show).toBe(true);
    expect(vm.session.session?.kycStatus).toBe("approved");
  });

  it("hides the CTA for onsite sales", () => {
    const vm = buildLotConditionReportViewModel({
      auction: baseLot,
      session: null,
      saleDeliveryMode: "onsite",
      auctionStatus: "active",
      kycSummary: null,
      kycUnavailable: false,
      kycFeedbackDto: null,
      loginNextPath: "/lot/lot-1",
      canParticipate: true,
      publishedConditionReport: null,
      buyerConditionReportRequest: null,
    });

    expect(vm.session.show).toBe(false);
  });

  it("requires email verification before request when KYC is approved", () => {
    const vm = buildLotConditionReportViewModel({
      auction: baseLot,
      session: {
        id: "user-1",
        email: "buyer@example.com",
        emailVerified: false,
        kycStatus: "approved",
      } as LotPageShellData["session"],
      saleDeliveryMode: "online",
      auctionStatus: "active",
      kycSummary: null,
      kycUnavailable: false,
      kycFeedbackDto: null,
      loginNextPath: "/lot/lot-1",
      canParticipate: true,
      publishedConditionReport: null,
      buyerConditionReportRequest: null,
    });

    expect(vm.session.session?.emailVerified).toBe(false);
    expect(vm.session.session?.kycStatus).toBe("approved");
  });
});

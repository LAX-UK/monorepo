import type { ConsignmentAgreement } from "@auction/types";
import { describe, expect, it } from "vitest";
import { consignmentAgreementViewModel, termsVersionName } from "./consignment-agreement-view";

const base: ConsignmentAgreement = {
  id: "agr-1",
  submissionId: "sub-1",
  legalEntityId: "le-1",
  termsVersion: "conditions-of-business-part-c-v1",
  estimateLow: "8000.00",
  estimateHigh: "12000.00",
  reservePrice: "7000.00",
  commissionPercent: "15.00",
  currency: "GBP",
  proposedAt: new Date("2026-10-04T10:00:00Z"),
  acceptedAt: null,
  acceptedByUserId: null,
  acceptedByName: null,
};

describe("consignmentAgreementViewModel", () => {
  it("shows the estimate, reserve and commission the specialist proposed", () => {
    expect(consignmentAgreementViewModel(base).terms).toEqual([
      { label: "Estimate", value: "£8,000 – £12,000" },
      { label: "Reserve", value: "£7,000" },
      { label: "Seller's commission", value: "15%" },
      { label: "Proposed", value: "4 Oct 2026" },
    ]);
  });

  it("leaves out figures the specialist has not given", () => {
    const terms = consignmentAgreementViewModel({
      ...base,
      estimateLow: null,
      estimateHigh: null,
      reservePrice: null,
      commissionPercent: null,
    }).terms;
    expect(terms.map((t) => t.label)).toEqual(["Proposed"]);
  });

  it("records who accepted, when, and which version", () => {
    const vm = consignmentAgreementViewModel({
      ...base,
      acceptedAt: new Date("2026-10-05T12:00:00Z"),
      acceptedByUserId: "u1",
      acceptedByName: "Jane Smith",
    });
    expect(vm.accepted).toEqual({ by: "Jane Smith", on: "5 Oct 2026" });
    expect(vm.versionName).toBe("Version 1");
  });

  it("keeps unknown versions readable", () => {
    expect(termsVersionName("conditions-v9")).toBe("conditions-v9");
  });
});

import type { ConsignmentAgreement } from "@auction/types";
import { describe, expect, it } from "vitest";
import { agreementDocumentRows } from "./agreement-documents.vm";

const agreement = (over: Partial<ConsignmentAgreement>): ConsignmentAgreement => ({
  id: "a",
  submissionId: "s1",
  legalEntityId: "org",
  termsVersion: "1",
  estimateLow: null,
  estimateHigh: null,
  reservePrice: null,
  commissionPercent: null,
  currency: "GBP",
  proposedAt: new Date("2026-10-20T10:00:00Z"),
  acceptedAt: null,
  acceptedByUserId: null,
  ...over,
});

describe("agreementDocumentRows", () => {
  it("names the work, who accepted and when, newest first, with its PDF", () => {
    const rows = agreementDocumentRows(
      [
        agreement({ submissionId: "s1" }),
        agreement({
          submissionId: "s2",
          acceptedAt: new Date("2026-10-29T16:20:00Z"),
          acceptedByName: "Maya Okafor",
        }),
      ],
      new Map([
        ["s1", "Thames at low tide"],
        ["s2", "Low cloud, Rye"],
      ]),
    );
    expect(rows.map((r) => r.title)).toEqual([
      "Consignment agreement · Low cloud, Rye",
      "Consignment agreement · Thames at low tide",
    ]);
    expect(rows[0]?.detail).toMatch(/^Accepted by Maya Okafor, 29.Oct.2026$/);
    expect(rows[1]?.accepted).toBe(false);
    expect(rows[0]?.href).toBe("/organisation/documents/agreements/s2");
  });
});

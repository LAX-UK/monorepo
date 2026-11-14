import type { consignmentAgreement } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { nextAgreementVersion } from "./agreement-version.js";

const at = new Date("2026-11-14T10:00:00Z");

function signed(): typeof consignmentAgreement.$inferSelect {
  return {
    id: "agreement-v2",
    submissionId: "submission-1",
    legalEntityId: "seller-1",
    termsVersion: "conditions-of-business-part-c-v1",
    estimateLow: "1000.00",
    estimateHigh: "1500.00",
    reservePrice: "900.00",
    commissionPercent: "12.00",
    relistReserveFloor: null,
    currency: "GBP",
    proposedByUserId: "specialist-1",
    proposedAt: new Date("2026-10-01T10:00:00Z"),
    acceptedAt: new Date("2026-10-02T10:00:00Z"),
    acceptedByUserId: "seller-user-1",
    source: "online",
    recordedByUserId: null,
    signedDocumentId: null,
    recordReason: null,
    replacesAgreementId: null,
    version: 2,
    supersededAt: null,
    supersededBy: null,
    reminderDay3SentAt: new Date("2026-10-04T10:00:00Z"),
    reminderDay7SentAt: null,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-10-02T10:00:00Z"),
  };
}

describe("nextAgreementVersion", () => {
  it("numbers the next version one up, keeps it current and gives it its own id and times", () => {
    const next = nextAgreementVersion(signed(), {}, { id: "agreement-v3", at });
    expect(next).toMatchObject({
      id: "agreement-v3",
      submissionId: "submission-1",
      version: 3,
      supersededAt: null,
      supersededBy: null,
      createdAt: at,
      updatedAt: at,
    });
  });

  it("carries the previous version's terms and applies the edit over them", () => {
    const next = nextAgreementVersion(
      signed(),
      { commissionPercent: "15.00", source: "recorded", signedDocumentId: "pdf-2" },
      { id: "agreement-v3", at },
    );
    expect(next).toMatchObject({
      legalEntityId: "seller-1",
      termsVersion: "conditions-of-business-part-c-v1",
      estimateLow: "1000.00",
      estimateHigh: "1500.00",
      reservePrice: "900.00",
      proposedAt: new Date("2026-10-01T10:00:00Z"),
      acceptedAt: new Date("2026-10-02T10:00:00Z"),
      commissionPercent: "15.00",
      source: "recorded",
      signedDocumentId: "pdf-2",
    });
  });

  it("starts the reminders over: they chased the earlier proposal", () => {
    const next = nextAgreementVersion(signed(), {}, { id: "agreement-v3", at });
    expect(next.reminderDay3SentAt).toBeUndefined();
    expect(next.reminderDay7SentAt).toBeUndefined();
  });
});

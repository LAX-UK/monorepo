import { describe, expect, it } from "vitest";
import {
  KYC_RETENTION_INVENTORY,
  isRetentionExpired,
  latestClosureThatCanBeDue,
  relationshipEndedAt,
  retentionEndsAt,
} from "./kyc-retention-policy.js";

const closedAt = new Date("2020-03-10T12:00:00.000Z");

describe("relationshipEndedAt", () => {
  it("is the closure when nothing happened after it", () => {
    expect(relationshipEndedAt({ closedAt, lastActivityAt: null })).toEqual(closedAt);
    expect(
      relationshipEndedAt({ closedAt, lastActivityAt: new Date("2019-01-01T00:00:00.000Z") }),
    ).toEqual(closedAt);
  });

  it("is the later activity when a transaction followed the closure", () => {
    const later = new Date("2021-06-01T00:00:00.000Z");
    expect(relationshipEndedAt({ closedAt, lastActivityAt: later })).toEqual(later);
  });
});

describe("retention boundary", () => {
  const ends = retentionEndsAt(closedAt);

  it("ends five calendar years after the relationship ended", () => {
    expect(ends.toISOString()).toBe("2025-03-10T12:00:00.000Z");
  });

  it("is not due one day before five years", () => {
    expect(isRetentionExpired(closedAt, new Date("2025-03-09T12:00:00.000Z"))).toBe(false);
  });

  it("is not due at the moment the five years end", () => {
    expect(isRetentionExpired(closedAt, ends)).toBe(false);
  });

  it("is due one day after five years", () => {
    expect(isRetentionExpired(closedAt, new Date("2025-03-11T12:00:00.000Z"))).toBe(true);
  });

  it("rolls 29 February forward, never back", () => {
    expect(retentionEndsAt(new Date("2020-02-29T00:00:00.000Z")).toISOString()).toBe(
      "2025-03-01T00:00:00.000Z",
    );
  });

  it("narrows candidates to subjects closed more than five years ago", () => {
    expect(latestClosureThatCanBeDue(new Date("2026-11-02T00:00:00.000Z")).toISOString()).toBe(
      "2021-11-02T00:00:00.000Z",
    );
  });
});

describe("inventory", () => {
  it("lists each purged table once per subject kind", () => {
    const keys = KYC_RETENTION_INVENTORY.map((e) => `${e.subjectKind}:${e.recordKind}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("marks every file-bearing record", () => {
    const withFiles = KYC_RETENTION_INVENTORY.filter((e) => e.hasStoredFile).map((e) => e.table);
    expect(new Set(withFiles)).toEqual(
      new Set(["source_of_funds_document", "legal_entity_document", "upload_object"]),
    );
  });
});

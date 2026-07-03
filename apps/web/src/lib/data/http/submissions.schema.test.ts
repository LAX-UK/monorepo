import { parseItemSubmissionSchema } from "@/lib/data/http/submissions.schema";
import type { ItemSubmission, ItemSubmissionStatus } from "@auction/types";
import { itemSubmissionStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date(Number.NaN);
}

function isItemSubmissionStatus(s: string): s is ItemSubmissionStatus {
  return (itemSubmissionStatuses as readonly string[]).includes(s);
}

/** Legacy cast parser — parity reference until schema is proven equivalent. */
function legacyParseItemSubmission(raw: unknown): ItemSubmission {
  const o = raw as Record<string, unknown>;
  const status =
    typeof o.status === "string" && isItemSubmissionStatus(o.status) ? o.status : "submitted";
  const legalEntityId =
    o.legalEntityId == null || o.legalEntityId === "" ? undefined : String(o.legalEntityId);
  const sellerId = o.sellerId == null || o.sellerId === "" ? undefined : String(o.sellerId);

  return {
    id: String(o.id),
    ...(legalEntityId ? { legalEntityId } : {}),
    ...(sellerId ? { sellerId } : {}),
    title: String(o.title),
    description: o.description == null || o.description === "" ? null : String(o.description),
    medium: o.medium == null || o.medium === "" ? null : String(o.medium),
    dimensions: o.dimensions == null || o.dimensions === "" ? null : String(o.dimensions),
    images: Array.isArray(o.images) ? (o.images as unknown[]).map(String) : [],
    yearOfWork: o.yearOfWork == null || o.yearOfWork === "" ? null : String(o.yearOfWork),
    isSigned: Boolean(o.isSigned),
    signatureNote:
      o.signatureNote == null || o.signatureNote === "" ? null : String(o.signatureNote),
    edition: o.edition == null || o.edition === "" ? null : String(o.edition),
    conditionSelfReport:
      o.conditionSelfReport == null || o.conditionSelfReport === ""
        ? null
        : String(o.conditionSelfReport),
    provenance: Array.isArray(o.provenance)
      ? (o.provenance as { period?: string; note: string }[])
      : [],
    exhibitions: Array.isArray(o.exhibitions)
      ? (o.exhibitions as { year?: string; venue: string; note?: string }[])
      : [],
    askingPrice: o.askingPrice == null || o.askingPrice === "" ? null : String(o.askingPrice),
    reservePrice: o.reservePrice == null || o.reservePrice === "" ? null : String(o.reservePrice),
    categoryIds: Array.isArray(o.categoryIds) ? (o.categoryIds as unknown[]).map(String) : [],
    categoryId: String(o.categoryId ?? ""),
    submitterNotes:
      o.submitterNotes == null || o.submitterNotes === "" ? null : String(o.submitterNotes),
    status,
    reviewedBy: o.reviewedBy == null || o.reviewedBy === "" ? null : String(o.reviewedBy),
    reviewedAt: o.reviewedAt == null || o.reviewedAt === "" ? null : toDate(o.reviewedAt),
    reviewNotes: o.reviewNotes == null || o.reviewNotes === "" ? null : String(o.reviewNotes),
    rejectionReason:
      o.rejectionReason == null || o.rejectionReason === "" ? null : String(o.rejectionReason),
    convertedLotId:
      o.convertedLotId == null || o.convertedLotId === "" ? null : String(o.convertedLotId),
    assignedToUserId:
      o.assignedToUserId == null || o.assignedToUserId === "" ? null : String(o.assignedToUserId),
    createdAt: toDate(o.createdAt),
    updatedAt: toDate(o.updatedAt),
  };
}

const happyPathFixture = {
  id: "sub-1",
  legalEntityId: "00000000-0000-4000-8000-000000000010",
  title: "Blue vase",
  description: "A fine piece",
  medium: "ceramic",
  dimensions: "10x10 cm",
  images: ["img-1", "img-2"],
  yearOfWork: "1920",
  isSigned: true,
  signatureNote: "underside",
  edition: "1/12",
  conditionSelfReport: "excellent",
  provenance: [{ period: "1920s", note: "Paris gallery" }],
  exhibitions: [{ year: "2020", venue: "Tate", note: "solo" }],
  askingPrice: "1000.00",
  reservePrice: "800.00",
  categoryIds: ["cat-1", "cat-2"],
  categoryId: "cat-1",
  submitterNotes: "handle with care",
  status: "submitted",
  reviewedBy: "admin-1",
  reviewedAt: "2026-01-02T00:00:00.000Z",
  reviewNotes: "looks good",
  rejectionReason: null,
  convertedLotId: null,
  assignedToUserId: "staff-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
};

const minimalFixture = {
  id: "sub-min",
  title: "Untitled",
  description: null,
  images: [],
  categoryId: "cat-1",
  status: "submitted",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const lenientFixture = {
  id: 42,
  title: 99,
  description: "",
  medium: "",
  images: "not-an-array",
  categoryIds: [1, 2],
  categoryId: null,
  status: "not-a-real-status",
  provenance: [{ bad: true }],
  exhibitions: "nope",
  reviewedAt: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("itemSubmissionSchema parity with legacy parseItemSubmission", () => {
  it("matches happy-path fixture", () => {
    expect(parseItemSubmissionSchema(happyPathFixture)).toEqual(
      legacyParseItemSubmission(happyPathFixture),
    );
  });

  it("matches minimal fixture", () => {
    expect(parseItemSubmissionSchema(minimalFixture)).toEqual(
      legacyParseItemSubmission(minimalFixture),
    );
  });

  it("matches lenient fixture (unknown status, missing fields, malformed arrays)", () => {
    expect(parseItemSubmissionSchema(lenientFixture)).toEqual(
      legacyParseItemSubmission(lenientFixture),
    );
  });

  it("maps legalEntityId and omits empty sellerId", () => {
    const fixture = {
      ...minimalFixture,
      legalEntityId: "00000000-0000-4000-8000-000000000010",
      sellerId: "",
    };
    expect(parseItemSubmissionSchema(fixture)).toEqual(legacyParseItemSubmission(fixture));
  });
});

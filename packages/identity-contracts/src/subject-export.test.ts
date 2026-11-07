import { describe, expect, it } from "vitest";
import { IDENTITY_EVENT_TYPES, identityEventPayloadSchemasV1 } from "./events.js";
import {
  SUBJECT_EXPORT_CATEGORIES,
  SUBJECT_EXPORT_MACHINE_SCOPE,
  SUBJECT_EXPORT_PRODUCTS,
  SUBJECT_EXPORT_PRODUCT_INFO,
  findSubjectExportCategory,
  subjectExportCategoryIds,
  subjectExportCreateOutcomeSchema,
  subjectExportDueAt,
  subjectExportFileSchema,
  subjectExportManifestPath,
  subjectExportManifestSchema,
  subjectExportMoneySchema,
  subjectExportPagePath,
  subjectExportPageSchema,
  subjectExportProgressPath,
  subjectExportProgressSchema,
  subjectExportPurgePendingPath,
  subjectExportPurgedPath,
  subjectExportSchemaName,
  subjectExportStatusSchema,
  subjectExportViewSchema,
} from "./subject-export.js";

const VIEW = {
  id: "exp_1",
  status: "collecting",
  requestedAt: "2026-11-02T14:02:00.000Z",
  dueAt: "2026-12-02T14:02:00.000Z",
  readyAt: null,
  expiresAt: null,
  fileName: null,
  sizeBytes: null,
  downloadCount: 0,
  deletedAt: null,
  products: [
    { product: "account", state: "done" },
    { product: "bid", state: "retrying" },
    { product: "shop", state: "waiting" },
  ],
};

describe("subjectExportDueAt", () => {
  const due = (iso: string) => subjectExportDueAt(new Date(iso)).toISOString();

  it("is the same date next month", () => {
    expect(due("2026-11-02T14:02:00.000Z")).toBe("2026-12-02T14:02:00.000Z");
  });

  it("falls back to the last day of a shorter month", () => {
    expect(due("2026-01-31T09:00:00.000Z")).toBe("2026-02-28T09:00:00.000Z");
    expect(due("2026-03-31T09:00:00.000Z")).toBe("2026-04-30T09:00:00.000Z");
    expect(due("2026-08-31T09:00:00.000Z")).toBe("2026-09-30T09:00:00.000Z");
  });

  it("uses 29 February in a leap year", () => {
    expect(due("2028-01-31T09:00:00.000Z")).toBe("2028-02-29T09:00:00.000Z");
    expect(due("2028-01-29T09:00:00.000Z")).toBe("2028-02-29T09:00:00.000Z");
    expect(due("2027-01-29T09:00:00.000Z")).toBe("2027-02-28T09:00:00.000Z");
  });

  it("rolls December into January of the next year", () => {
    expect(due("2026-12-31T23:59:59.000Z")).toBe("2027-01-31T23:59:59.000Z");
  });

  it("counts in UTC, not in the local zone", () => {
    expect(due("2026-01-30T23:30:00.000Z")).toBe("2026-02-28T23:30:00.000Z");
  });
});

describe("export categories", () => {
  it.each(SUBJECT_EXPORT_PRODUCTS)("has unique, file-safe ids for %s", (product) => {
    const ids = subjectExportCategoryIds(product);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("matches the approved list for each product", () => {
    expect(subjectExportCategoryIds("account")).toEqual([
      "profile",
      "contact",
      "addresses",
      "sign-in-and-security",
      "consents",
      "requests",
    ]);
    expect(subjectExportCategoryIds("bid")).toHaveLength(13);
    expect(subjectExportCategoryIds("shop")).toEqual([
      "shop-profile",
      "orders",
      "invoices",
      "payments",
      "basket",
      "enquiries",
      "saved-works",
      "selling",
      "selling-payouts",
      "notifications-and-marketing",
    ]);
  });

  it("describes every category and every field in a sentence", () => {
    for (const product of SUBJECT_EXPORT_PRODUCTS) {
      for (const entry of SUBJECT_EXPORT_CATEGORIES[product]) {
        expect(entry.description.trim().length, `${product}/${entry.id}`).toBeGreaterThan(10);
        expect(entry.description.endsWith("."), `${product}/${entry.id}`).toBe(true);
        expect(entry.origins.length).toBeGreaterThan(0);
        expect(entry.fields.length).toBeGreaterThan(0);
        const names = entry.fields.map((field) => field.name);
        expect(new Set(names).size, `${product}/${entry.id}`).toBe(names.length);
        for (const field of entry.fields) {
          expect(field.name).not.toMatch(/^(id|origin)$/);
          expect(field.description.endsWith("."), `${product}/${entry.id}.${field.name}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("finds a category by product and id", () => {
    expect(findSubjectExportCategory("bid", "bids")?.title).toBe("Bids");
    expect(findSubjectExportCategory("bid", "orders")).toBeUndefined();
  });

  it("names a company for every product", () => {
    for (const product of SUBJECT_EXPORT_PRODUCTS) {
      expect(SUBJECT_EXPORT_PRODUCT_INFO[product].controllers.length).toBeGreaterThan(0);
    }
  });
});

describe("paths and names", () => {
  it("builds the internal product routes with encoded parts", () => {
    expect(subjectExportManifestPath("a/b")).toBe("/internal/identity/subjects/a%2Fb/export");
    expect(subjectExportPagePath("abc", "bids")).toBe(
      "/internal/identity/subjects/abc/export/bids",
    );
    expect(subjectExportPagePath("abc", "bids", "c=1&x")).toBe(
      "/internal/identity/subjects/abc/export/bids?cursor=c%3D1%26x",
    );
    expect(subjectExportProgressPath("exp_1")).toBe(
      "/internal/identity/subject-exports/exp_1/progress",
    );
    expect(subjectExportPurgePendingPath()).toBe(
      "/internal/identity/subject-exports/purge-pending",
    );
    expect(subjectExportPurgePendingPath(50)).toBe(
      "/internal/identity/subject-exports/purge-pending?limit=50",
    );
    expect(subjectExportPurgedPath("exp/1")).toBe(
      "/internal/identity/subject-exports/exp%2F1/purged",
    );
  });

  it("versions the schema name", () => {
    expect(subjectExportSchemaName("bid", "bids")).toBe("lax.subject-export/bid/bids@1");
  });

  it("keeps the machine scope apart from deletion eligibility", () => {
    expect(SUBJECT_EXPORT_MACHINE_SCOPE).toBe("subject_export");
  });
});

describe("schema round trips", () => {
  it("round trips a manifest and a page", () => {
    const manifest = {
      product: "bid",
      categories: [{ id: "bids", schemaVersion: 1, count: 126 }],
    };
    expect(subjectExportManifestSchema.parse(manifest)).toEqual(manifest);
    const page = {
      records: [{ id: "bid_1", origin: "provided", amount: { minor: 260000, currency: "GBP" } }],
      nextCursor: null,
    };
    expect(subjectExportPageSchema.parse(page)).toEqual(page);
  });

  it("round trips the JSON file envelope, including an empty category", () => {
    const file = {
      schema: subjectExportSchemaName("bid", "bids"),
      product: "LAX Bid",
      controller: "London Auction Xchange LTD",
      generatedAt: "2026-11-02T14:03:11Z",
      records: [{ id: "bid_1", origin: "provided" }],
    };
    expect(subjectExportFileSchema.parse(file)).toEqual(file);
    expect(subjectExportFileSchema.parse({ ...file, records: [] }).records).toEqual([]);
  });

  it("requires every record to carry a known origin", () => {
    expect(
      subjectExportPageSchema.safeParse({ records: [{ id: "x" }], nextCursor: null }).success,
    ).toBe(false);
    expect(
      subjectExportPageSchema.safeParse({
        records: [{ id: "x", origin: "guessed" }],
        nextCursor: null,
      }).success,
    ).toBe(false);
    for (const origin of ["provided", "observed", "made_by_us"]) {
      expect(
        subjectExportPageSchema.safeParse({ records: [{ id: "x", origin }], nextCursor: null })
          .success,
      ).toBe(true);
    }
  });

  it("holds money as whole minor units and dates as UTC", () => {
    expect(subjectExportMoneySchema.safeParse({ minor: 260000, currency: "GBP" }).success).toBe(
      true,
    );
    expect(subjectExportMoneySchema.safeParse({ minor: 2600.5, currency: "GBP" }).success).toBe(
      false,
    );
    expect(subjectExportMoneySchema.safeParse({ minor: 1, currency: "gbp" }).success).toBe(false);
    expect(
      subjectExportFileSchema.safeParse({
        schema: "lax.subject-export/bid/bids@1",
        product: "LAX Bid",
        controller: "x",
        generatedAt: "2026-11-02T14:03:11+01:00",
        records: [],
      }).success,
    ).toBe(false);
  });

  it("rejects a page over the record ceiling", () => {
    const records = Array.from({ length: 501 }, (_, i) => ({ id: `r${i}`, origin: "provided" }));
    expect(subjectExportPageSchema.safeParse({ records, nextCursor: null }).success).toBe(false);
  });

  it("accepts every status and no other", () => {
    for (const status of [
      "requested",
      "collecting",
      "delayed",
      "ready",
      "expired",
      "deleted",
      "failed",
    ]) {
      expect(subjectExportStatusSchema.safeParse(status).success).toBe(true);
    }
    expect(subjectExportStatusSchema.safeParse("pending").success).toBe(false);
  });

  it("round trips the Account view and the create outcomes", () => {
    expect(subjectExportViewSchema.parse(VIEW)).toEqual(VIEW);
    for (const outcome of [
      { outcome: "requested", export: VIEW },
      { outcome: "already_open", export: VIEW },
      { outcome: "rate_limited", retryAfter: "2026-11-20T10:00:00.000Z" },
    ]) {
      expect(subjectExportCreateOutcomeSchema.parse(outcome)).toEqual(outcome);
    }
    expect(subjectExportViewSchema.safeParse({ ...VIEW, status: "nope" }).success).toBe(false);
  });

  it("validates worker progress reports", () => {
    expect(
      subjectExportProgressSchema.safeParse({
        event: "ready",
        objectKey: "subject-exports/exp_1/lax-data-2026-11-02.zip",
        fileName: "lax-data-2026-11-02.zip",
        sizeBytes: 38_000_000,
        sha256: "a".repeat(64),
      }).success,
    ).toBe(true);
    expect(
      subjectExportProgressSchema.safeParse({
        event: "delayed",
        product: "bid",
        errorCode: "timeout",
      }).success,
    ).toBe(true);
    expect(subjectExportProgressSchema.safeParse({ event: "ready", sha256: "short" }).success).toBe(
      false,
    );
  });
});

describe("subject.data_export_requested event", () => {
  const schema = identityEventPayloadSchemasV1[IDENTITY_EVENT_TYPES.DATA_EXPORT_REQUESTED];

  it("is registered under its type name", () => {
    expect(IDENTITY_EVENT_TYPES.DATA_EXPORT_REQUESTED).toBe("subject.data_export_requested");
  });

  it("carries the subject id and export id only", () => {
    const payload = { schemaVersion: 1 as const, subjectId: "s1", exportId: "exp_1" };
    expect(schema.parse(payload)).toEqual(payload);
    expect(schema.parse({ ...payload, email: "a@b.c" })).toEqual(payload);
    expect(schema.safeParse({ schemaVersion: 1, subjectId: "s1" }).success).toBe(false);
  });
});

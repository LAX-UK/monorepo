import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { describe, expect, it } from "vitest";
import { DrizzleCrmRecordLinkRepository } from "./drizzle-crm-record-link.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleCrmRecordLinkRepository (integration)", () => {
  it("tombstones subjects without an existing link row", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const repo = new DrizzleCrmRecordLinkRepository(db);
    const subjectId = `tombstone-${randomUUID()}`;

    await repo.tombstone({
      entityType: "subject",
      entityId: subjectId,
      tombstoneModule: "__tombstone__",
      tombstoneRecordId: "__none__",
    });

    expect(await repo.isErased("subject", subjectId)).toBe(true);
    const row = await repo.findByEntity("subject", subjectId);
    expect(row?.erasedAt).not.toBeNull();
  });

  it("merge keeps canonical link and tombstones retired duplicate", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const repo = new DrizzleCrmRecordLinkRepository(db);
    const canonical = `canonical-${randomUUID()}`;
    const retired = `retired-${randomUUID()}`;

    await repo.upsertLink({
      entityType: "subject",
      entityId: canonical,
      zohoModule: "Contacts",
      zohoRecordId: `zoho-${randomUUID()}`,
    });
    await repo.upsertLink({
      entityType: "subject",
      entityId: retired,
      zohoModule: "Leads",
      zohoRecordId: `zoho-${randomUUID()}`,
    });

    const merge = await repo.mergeSubjectLinks({
      canonicalSubjectId: canonical,
      retiredSubjectId: retired,
      tombstoneModule: "__tombstone__",
      tombstoneRecordId: "__none__",
    });

    expect(merge.duplicateZohoRecordId).toBeTruthy();
    expect(await repo.isErased("subject", retired)).toBe(true);
    const canonicalRow = await repo.findByEntity("subject", canonical);
    expect(canonicalRow?.zohoModule).toBe("Contacts");
  });

  it("merge does not promote placeholder links onto canonical subject", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const repo = new DrizzleCrmRecordLinkRepository(db);
    const canonical = `canonical-ph-${randomUUID()}`;
    const retired = `retired-ph-${randomUUID()}`;

    await repo.upsertLink({
      entityType: "subject",
      entityId: canonical,
      zohoModule: "Contacts",
      zohoRecordId: `zoho-${randomUUID()}`,
    });
    await repo.upsertLink({
      entityType: "subject",
      entityId: retired,
      zohoModule: "__pending__",
      zohoRecordId: "__none__",
    });

    const merge = await repo.mergeSubjectLinks({
      canonicalSubjectId: canonical,
      retiredSubjectId: retired,
      tombstoneModule: "__tombstone__",
      tombstoneRecordId: "__none__",
    });

    expect(merge.duplicateZohoRecordId).toBeUndefined();
    const canonicalRow = await repo.findByEntity("subject", canonical);
    expect(canonicalRow?.zohoModule).toBe("Contacts");
    expect(await repo.isErased("subject", retired)).toBe(false);
  });

  it("merge reassigns deal subject_id from retired to canonical", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const repo = new DrizzleCrmRecordLinkRepository(db);
    const canonical = `canonical-deal-${randomUUID()}`;
    const retired = `retired-deal-${randomUUID()}`;
    const dealEntityId = `shop-order:${randomUUID()}`;

    await repo.upsertLink({
      entityType: "subject",
      entityId: canonical,
      zohoModule: "Contacts",
      zohoRecordId: `zoho-${randomUUID()}`,
    });
    await repo.upsertLink({
      entityType: "subject",
      entityId: retired,
      zohoModule: "Leads",
      zohoRecordId: `zoho-${randomUUID()}`,
    });
    await repo.upsertLink({
      entityType: "deal",
      entityId: dealEntityId,
      zohoModule: "Deals",
      zohoRecordId: `deal-${randomUUID()}`,
      subjectId: retired,
    });

    await repo.mergeSubjectLinks({
      canonicalSubjectId: canonical,
      retiredSubjectId: retired,
      tombstoneModule: "__tombstone__",
      tombstoneRecordId: "__none__",
    });

    const dealRow = await repo.findByEntity("deal", dealEntityId);
    expect(dealRow?.subjectId).toBe(canonical);
  });
});

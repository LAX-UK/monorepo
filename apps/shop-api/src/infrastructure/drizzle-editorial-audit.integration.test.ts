import { shopAdminAudit, shopEditorialPage } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleEditorialRepository } from "./drizzle-editorial.repository.js";

const ACTOR = "audit-test-editor";

describe.skipIf(!hasShopIntegrationDb)("editorial writes are audited", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  function setup() {
    const db = createShopDb(shopPool);
    const repo = createDrizzleEditorialRepository(db, {
      resolveMediaUrl: (value) => value ?? null,
    });
    const auditRows = (targetId: string) =>
      db
        .select({ action: shopAdminAudit.action, capability: shopAdminAudit.capability })
        .from(shopAdminAudit)
        .where(and(eq(shopAdminAudit.actorSubjectId, ACTOR), eq(shopAdminAudit.targetId, targetId)))
        .orderBy(shopAdminAudit.createdAt);
    return { db, repo, auditRows };
  }

  const slug = () => `audit-${Math.random().toString(36).slice(2, 10)}`;

  it("writes one audit row per create, update, publish and unpublish", async () => {
    const { repo, auditRows } = setup();
    const { id } = await repo.createPage({
      slug: slug(),
      title: "Audit me",
      body: [],
      updatedBy: ACTOR,
    });
    await repo.updatePage(id, { slug: slug(), title: "Audited", body: [], updatedBy: ACTOR });
    await repo.setPagePublication(id, true, ACTOR);
    await repo.setPagePublication(id, false, ACTOR);

    expect(await auditRows(id)).toEqual([
      { action: "editorial.page.create", capability: "editorial.write" },
      { action: "editorial.page.update", capability: "editorial.write" },
      { action: "editorial.page.publish", capability: "editorial.publish" },
      { action: "editorial.page.unpublish", capability: "editorial.publish" },
    ]);
  });

  it("writes no audit row when the update matches no record", async () => {
    const { repo, auditRows } = setup();
    const missing = "55555555-5555-4555-8555-555555555555";
    await repo.updatePage(missing, { slug: slug(), title: "Nope", body: [], updatedBy: ACTOR });
    expect(await auditRows(missing)).toEqual([]);
  });

  it("audits a placement replacement and a preview token", async () => {
    const { repo, auditRows } = setup();
    await repo.replacePlacementSlot("home_hero", [], ACTOR);
    // The slot id is a fixed enum value, so earlier runs may have left rows of their own.
    expect((await auditRows("home_hero")).at(-1)).toEqual({
      action: "editorial.placement.replace",
      capability: "editorial.publish",
    });

    const pageId = "66666666-6666-4666-8666-666666666666";
    await repo.recordPreviewTokenIssued("page", pageId, ACTOR);
    expect(await auditRows(pageId)).toEqual([
      { action: "editorial.preview_token.issue", capability: "editorial.write" },
    ]);
  });

  it("rolls the change back when its audit row cannot be written", async () => {
    const { db, repo } = setup();
    const pageSlug = slug();
    // A missing actor makes the audit insert violate its NOT NULL constraint.
    await expect(
      repo.createPage({
        slug: pageSlug,
        title: "Rolled back",
        body: [],
        updatedBy: undefined as unknown as string,
      }),
    ).rejects.toThrow();
    const rows = await db
      .select({ id: shopEditorialPage.id })
      .from(shopEditorialPage)
      .where(eq(shopEditorialPage.slug, pageSlug));
    expect(rows).toEqual([]);
  });
});

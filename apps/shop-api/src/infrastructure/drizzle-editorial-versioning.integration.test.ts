import { shopAdminAudit, shopEditorialExhibition } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleEditorialRepository } from "./drizzle-editorial.repository.js";

const ACTOR = "versioning-test-editor";

describe.skipIf(!hasShopIntegrationDb)("editorial saves compare the row version", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  const uniqueSlug = () => `version-${Math.random().toString(36).slice(2, 10)}`;

  async function createExhibition() {
    const db = createShopDb(shopPool);
    const repo = createDrizzleEditorialRepository(db, {
      resolveMediaUrl: (value) => value ?? null,
    });
    const slug = uniqueSlug();
    const { id } = await repo.createExhibition({
      slug,
      kind: "exhibition",
      title: "First title",
      summary: null,
      venueId: null,
      startsOn: null,
      endsOn: null,
      timesNote: null,
      coverMediaKey: null,
      featured: false,
      body: [],
      updatedBy: ACTOR,
    });
    const edit = (expectedVersion: string, title: string) =>
      repo.updateExhibition(id, {
        slug,
        kind: "exhibition",
        title,
        summary: null,
        venueId: null,
        startsOn: null,
        endsOn: null,
        timesNote: null,
        coverMediaKey: null,
        featured: false,
        body: [],
        subtitle: "Edited",
        expectedVersion,
        updatedBy: ACTOR,
      });
    const version = async () => (await repo.getAdminExhibitionById(id))?.updatedAt ?? "";
    const remove = () =>
      db.delete(shopEditorialExhibition).where(eq(shopEditorialExhibition.id, id));
    return { db, repo, id, edit, version, remove };
  }

  it("saves on a matching version and hands back the next one", async () => {
    const { repo, id, edit, version, remove } = await createExhibition();
    try {
      const first = await version();
      const outcome = await edit(first, "Second title");
      expect(outcome.status).toBe("updated");
      expect(outcome.status === "updated" && outcome.version).toBe(await version());
      expect((await repo.getAdminExhibitionById(id))?.title).toBe("Second title");
    } finally {
      await remove();
    }
  });

  it("refuses a stale version, reports the current one and writes nothing", async () => {
    const { db, repo, id, edit, version, remove } = await createExhibition();
    try {
      const opened = await version();
      await new Promise((resolve) => setTimeout(resolve, 5));
      const theirs = await edit(opened, "Their title");
      expect(theirs.status).toBe("updated");
      const current = await version();

      const mine = await edit(opened, "My title");
      expect(mine).toEqual({ status: "stale", currentVersion: current });
      const row = await repo.getAdminExhibitionById(id);
      expect(row?.title).toBe("Their title");
      expect(row?.updatedAt).toBe(current);

      const audited = await db
        .select({ action: shopAdminAudit.action })
        .from(shopAdminAudit)
        .where(and(eq(shopAdminAudit.actorSubjectId, ACTOR), eq(shopAdminAudit.targetId, id)));
      expect(audited.map((entry) => entry.action)).toEqual([
        "editorial.exhibition.create",
        "editorial.exhibition.update",
      ]);
    } finally {
      await remove();
    }
  });

  it("lets only one of two concurrent saves with the same version through", async () => {
    const { edit, version, remove } = await createExhibition();
    try {
      const opened = await version();
      const outcomes = await Promise.all([edit(opened, "Writer A"), edit(opened, "Writer B")]);
      expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(["stale", "updated"]);
    } finally {
      await remove();
    }
  });

  it("matches a row whose stored timestamp has microseconds", async () => {
    const { id, edit, version, remove } = await createExhibition();
    try {
      await ownerPool.query(
        "update shop_editorial_exhibition set updated_at = '2026-02-03 04:05:06.123456+00' where id = $1",
        [id],
      );
      const opened = await version();
      expect(opened).toBe("2026-02-03T04:05:06.123Z");
      expect((await edit(opened, "After microseconds")).status).toBe("updated");
    } finally {
      await remove();
    }
  });

  it("reports a missing row as not found rather than stale", async () => {
    const { edit, remove } = await createExhibition();
    await remove();
    const outcome = await edit(new Date().toISOString(), "Nobody home");
    expect(outcome).toEqual({ status: "not_found" });
  });
});

import { shopAdminAudit, shopHelpArticle, shopHelpCategory } from "@auction/db/schema";
import type { EditorialBlock } from "@auction/shop-contracts";
import { eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleEditorialRepository } from "./drizzle-editorial.repository.js";
import { createDrizzleHelpRepository } from "./drizzle-help.repository.js";

const ACTOR = "help-test-editor";

const paragraph = (text: string): EditorialBlock => ({ type: "richText", spans: [{ text }] });

describe.skipIf(!hasShopIntegrationDb)("help centre repository", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  const unique = () => Math.random().toString(36).slice(2, 10);

  function setup() {
    const db = createShopDb(shopPool);
    const repo = createDrizzleHelpRepository(db, { resolveMediaUrl: (value) => value ?? null });
    const createdCategories: string[] = [];
    const createdArticles: string[] = [];
    const category = async (title = "Buying") => {
      const { id } = await repo.createCategory({
        slug: `cat-${unique()}`,
        title,
        updatedBy: ACTOR,
      });
      createdCategories.push(id);
      return id;
    };
    const article = async (categoryId: string, question: string, answerText = "An answer.") => {
      const outcome = await repo.createArticle({
        categoryId,
        slug: `q-${unique()}`,
        question,
        body: [paragraph(answerText)],
        updatedBy: ACTOR,
      });
      if (outcome.status !== "ok") throw new Error(`create failed: ${outcome.status}`);
      createdArticles.push(outcome.value.id);
      return outcome.value.id;
    };
    const cleanup = async () => {
      if (createdArticles.length > 0) {
        await db.delete(shopHelpArticle).where(inArray(shopHelpArticle.id, createdArticles));
      }
      if (createdCategories.length > 0) {
        await db.delete(shopHelpCategory).where(inArray(shopHelpCategory.id, createdCategories));
      }
    };
    return { db, repo, category, article, cleanup };
  }

  it("shows only published questions in published categories, with counts", async () => {
    const { repo, category, article, cleanup } = setup();
    try {
      const liveTitle = `Live ${unique()}`;
      const hiddenTitle = `Hidden ${unique()}`;
      const live = await category(liveTitle);
      const hidden = await category(hiddenTitle);
      const first = await article(live, "How is my artwork packed?");
      const second = await article(live, "Can I track my delivery?");
      const inHidden = await article(hidden, "Where do viewings take place?");

      const mine = async () =>
        (await repo.listArticles({})).filter((row) =>
          [liveTitle, hiddenTitle].includes(row.categoryTitle),
        );
      expect(await mine()).toEqual([]);
      for (const id of [first, second, inHidden]) await repo.setArticlePublication(id, true, ACTOR);
      await repo.setCategoryPublication(live, true, ACTOR);

      const categories = await repo.listCategories();
      const shown = categories.find((row) => row.title === liveTitle);
      expect(shown?.articleCount).toBe(2);
      expect(categories.some((row) => row.title === hiddenTitle)).toBe(false);

      const questions = (await mine()).map((row) => row.question);
      expect(questions).toEqual(["How is my artwork packed?", "Can I track my delivery?"]);

      await repo.setArticlePublication(second, false, ACTOR);
      expect((await repo.listCategories()).find((row) => row.title === liveTitle)).toMatchObject({
        articleCount: 1,
      });
    } finally {
      await cleanup();
    }
  });

  it("searches questions and answer text, escaping LIKE wildcards", async () => {
    const { repo, category, article, cleanup } = setup();
    try {
      const cat = await category();
      await repo.setCategoryPublication(cat, true, ACTOR);
      const framed = await article(cat, "Is the artwork framed?", "Most works arrive unframed.");
      const discount = await article(cat, "Do you offer discounts?", "Only a 50% deposit applies.");
      for (const id of [framed, discount]) await repo.setArticlePublication(id, true, ACTOR);

      const byQuestion = await repo.listArticles({ q: "framed" });
      expect(byQuestion.map((row) => row.question)).toContain("Is the artwork framed?");
      const byAnswer = await repo.listArticles({ q: "unframed" });
      expect(byAnswer.map((row) => row.question)).toEqual(["Is the artwork framed?"]);
      expect((await repo.listArticles({ q: "50%" })).map((row) => row.question)).toEqual([
        "Do you offer discounts?",
      ]);
      // A bare wildcard is a literal, not "match everything".
      expect(await repo.listArticles({ q: "%%" })).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  it("returns a published answer by slug and nothing for a draft", async () => {
    const { repo, category, article, cleanup, db } = setup();
    try {
      const cat = await category();
      await repo.setCategoryPublication(cat, true, ACTOR);
      const id = await article(cat, "How do I pay?", "By card or bank transfer.");
      const [row] = await db
        .select({ slug: shopHelpArticle.slug })
        .from(shopHelpArticle)
        .where(eq(shopHelpArticle.id, id));
      const slug = row?.slug ?? "";

      expect(await repo.getArticleBySlug(slug)).toBeNull();
      await repo.setArticlePublication(id, true, ACTOR);
      const detail = await repo.getArticleBySlug(slug);
      expect(detail?.question).toBe("How do I pay?");
      expect(detail?.answer).toEqual([paragraph("By card or bank transfer.")]);
    } finally {
      await cleanup();
    }
  });

  it("refuses a stale save and keeps the newer one", async () => {
    const { repo, category, article, cleanup } = setup();
    try {
      const cat = await category();
      const id = await article(cat, "Original question?");
      const opened = await repo.getAdminArticleById(id);
      if (!opened) throw new Error("missing article");
      const edit = (question: string, expectedVersion: string) =>
        repo.updateArticle(id, {
          categoryId: cat,
          slug: opened.slug,
          question,
          body: [paragraph("Edited.")],
          expectedVersion,
          updatedBy: ACTOR,
        });

      const saved = await edit("Edited question?", opened.updatedAt);
      expect(saved.status).toBe("updated");
      const stale = await edit("Overwrite?", opened.updatedAt);
      expect(stale.status).toBe("stale");
      expect((await repo.getAdminArticleById(id))?.question).toBe("Edited question?");
    } finally {
      await cleanup();
    }
  });

  it("appends new rows and a moved question to the end, then reorders", async () => {
    const { repo, category, article, cleanup } = setup();
    try {
      const a = await category("A");
      const b = await category("B");
      const q1 = await article(a, "One?");
      const q2 = await article(a, "Two?");
      const q3 = await article(a, "Three?");
      const other = await article(b, "Elsewhere?");

      const order = async (categoryId: string) =>
        (await repo.listAdminArticles({ categoryId })).map((row) => row.id);
      expect(await order(a)).toEqual([q1, q2, q3]);

      expect(await repo.reorderArticles(a, [q3, q1, q2], ACTOR)).toEqual({
        status: "ok",
        value: null,
      });
      expect(await order(a)).toEqual([q3, q1, q2]);

      expect(await repo.reorderArticles(a, [q3, q1], ACTOR)).toEqual({ status: "list_changed" });
      expect(await repo.reorderArticles(a, [q3, q1, other], ACTOR)).toEqual({
        status: "list_changed",
      });

      const moving = await repo.getAdminArticleById(q1);
      if (!moving) throw new Error("missing article");
      await repo.updateArticle(q1, {
        categoryId: b,
        slug: moving.slug,
        question: moving.question,
        body: [],
        expectedVersion: moving.updatedAt,
        updatedBy: ACTOR,
      });
      expect(await order(b)).toEqual([other, q1]);

      const categories = (await repo.listAdminCategories()).map((row) => row.id);
      const reversed = [...categories].reverse();
      expect(await repo.reorderCategories(reversed, ACTOR)).toEqual({ status: "ok", value: null });
      expect((await repo.listAdminCategories()).map((row) => row.id)).toEqual(reversed);
    } finally {
      await cleanup();
    }
  });

  it("refuses to delete a category that still has questions", async () => {
    const { repo, category, article, cleanup } = setup();
    try {
      const cat = await category();
      const id = await article(cat, "Still here?");
      expect(await repo.deleteCategory(cat, ACTOR)).toEqual({ status: "not_empty" });
      expect(await repo.deleteArticle(id, ACTOR)).toBe(true);
      expect(await repo.deleteCategory(cat, ACTOR)).toEqual({ status: "ok", value: null });
      expect(await repo.deleteCategory(cat, ACTOR)).toEqual({ status: "not_found" });
    } finally {
      await cleanup();
    }
  });

  it("rejects an article for a category that does not exist", async () => {
    const { repo } = setup();
    const outcome = await repo.createArticle({
      categoryId: "99999999-9999-4999-8999-999999999999",
      slug: `q-${unique()}`,
      question: "Orphan?",
      body: [],
      updatedBy: ACTOR,
    });
    expect(outcome).toEqual({ status: "unknown_category" });
  });

  it("audits every write in the same transaction", async () => {
    const { db, repo, category, article, cleanup } = setup();
    try {
      const cat = await category();
      const id = await article(cat, "Audited?");
      await repo.setArticlePublication(id, true, ACTOR);
      await repo.setArticlePublication(id, false, ACTOR);
      await repo.deleteArticle(id, ACTOR);
      const rows = await db
        .select({ action: shopAdminAudit.action, capability: shopAdminAudit.capability })
        .from(shopAdminAudit)
        .where(eq(shopAdminAudit.targetId, id))
        .orderBy(shopAdminAudit.createdAt);
      expect(rows).toEqual([
        { action: "help.article.create", capability: "editorial.write" },
        { action: "help.article.publish", capability: "editorial.publish" },
        { action: "help.article.unpublish", capability: "editorial.publish" },
        { action: "help.article.delete", capability: "editorial.write" },
      ]);
    } finally {
      await cleanup();
    }
  });

  it("previews a draft answer as a page titled with its question", async () => {
    const { db, category, article, cleanup } = setup();
    try {
      const cat = await category();
      const id = await article(cat, "Can I preview this?", "Only staff can.");
      const editorial = createDrizzleEditorialRepository(db, {
        resolveMediaUrl: (value) => value ?? null,
      });
      expect(await editorial.getDraftEntityById("help_article", id)).toMatchObject({
        title: "Can I preview this?",
        body: [paragraph("Only staff can.")],
      });
      expect(
        await editorial.getDraftEntityById("help_article", "99999999-9999-4999-8999-999999999999"),
      ).toBeNull();
    } finally {
      await cleanup();
    }
  });
});

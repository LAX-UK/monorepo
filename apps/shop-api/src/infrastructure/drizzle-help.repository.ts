import type { Database } from "@auction/db";
import { shopHelpArticle, shopHelpCategory } from "@auction/db/schema";
import {
  HELP_ARTICLE_LIST_LIMIT,
  editorialBlocksPlainText,
  mapEditorialBlockMedia,
  parseEditorialBlocks,
} from "@auction/shop-contracts";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import type { HelpRepository } from "../application/ports/help.repository.js";
import { containsPattern } from "./drizzle-editorial-search.reader.js";
import {
  auditEditorialWrite,
  readBlocks,
  resolveRejectedUpdate,
  rethrowSlugConflict,
  sameVersion,
} from "./drizzle-editorial.repository.js";

/** Staff lists are small and unpaged; this only stops a runaway table from being read whole. */
const ADMIN_ARTICLE_LIST_LIMIT = 500;

const category = shopHelpCategory;
const article = shopHelpArticle;

function sameIds(existing: readonly string[], requested: readonly string[]): boolean {
  return (
    existing.length === requested.length &&
    new Set(requested).size === requested.length &&
    requested.every((id) => existing.includes(id))
  );
}

export function createDrizzleHelpRepository(
  db: Database,
  options: { resolveMediaUrl: (value: string | null | undefined) => string | null },
): HelpRepository {
  const articleSummaryColumns = {
    slug: article.slug,
    question: article.question,
    categorySlug: category.slug,
    categoryTitle: category.title,
  };

  /** Published questions in published categories: the only rows lax.art may show. */
  const publishedArticles = and(eq(article.status, "published"), eq(category.status, "published"));

  return {
    async listCategories() {
      return db
        .select({
          slug: category.slug,
          title: category.title,
          articleCount: sql<number>`count(${article.id})::int`,
        })
        .from(category)
        .innerJoin(
          article,
          and(eq(article.categoryId, category.id), eq(article.status, "published")),
        )
        .where(eq(category.status, "published"))
        .groupBy(category.id)
        .orderBy(asc(category.position), asc(category.title));
    },

    async listArticles({ categorySlug, q }) {
      const term = q?.trim();
      const pattern = term ? containsPattern(term) : null;
      return db
        .select(articleSummaryColumns)
        .from(article)
        .innerJoin(category, eq(category.id, article.categoryId))
        .where(
          and(
            publishedArticles,
            categorySlug ? eq(category.slug, categorySlug) : undefined,
            pattern
              ? or(ilike(article.question, pattern), ilike(article.answerText, pattern))
              : undefined,
          ),
        )
        .orderBy(asc(category.position), asc(article.position), asc(article.question))
        .limit(HELP_ARTICLE_LIST_LIMIT);
    },

    async getArticleBySlug(slug) {
      const [row] = await db
        .select({
          ...articleSummaryColumns,
          answerBlocks: article.answerBlocks,
          updatedAt: article.updatedAt,
          seoTitle: article.seoTitle,
          seoDescription: article.seoDescription,
        })
        .from(article)
        .innerJoin(category, eq(category.id, article.categoryId))
        .where(and(publishedArticles, eq(article.slug, slug)))
        .limit(1);
      if (!row) return null;
      const { answerBlocks, updatedAt, ...rest } = row;
      return {
        ...rest,
        answer: mapEditorialBlockMedia(readBlocks(answerBlocks), (key) =>
          options.resolveMediaUrl(key),
        ),
        updatedAt: updatedAt.toISOString(),
      };
    },

    async listAdminCategories() {
      const rows = await db
        .select({
          id: category.id,
          slug: category.slug,
          title: category.title,
          position: category.position,
          status: category.status,
          updatedAt: category.updatedAt,
          articleCount: sql<number>`count(${article.id})::int`,
          publishedArticleCount: sql<number>`(count(${article.id}) filter (where ${article.status} = 'published'))::int`,
        })
        .from(category)
        .leftJoin(article, eq(article.categoryId, category.id))
        .groupBy(category.id)
        .orderBy(asc(category.position), asc(category.title));
      return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
    },

    createCategory: (input) =>
      rethrowSlugConflict(
        db.transaction(async (tx) => {
          const [last] = await tx
            .select({ next: sql<number>`coalesce(max(${category.position}) + 1, 0)::int` })
            .from(category);
          const [row] = await tx
            .insert(category)
            .values({
              slug: input.slug,
              title: input.title,
              position: last?.next ?? 0,
              updatedBy: input.updatedBy,
            })
            .returning({ id: category.id });
          if (!row) throw new Error("help_category_create_failed");
          await auditEditorialWrite(
            tx,
            input.updatedBy,
            "editorial.write",
            "help.category.create",
            "help_category",
            row.id,
          );
          return { id: row.id };
        }),
      ),

    updateCategory: (id, input) =>
      rethrowSlugConflict(
        db.transaction(async (tx) => {
          const [row] = await tx
            .update(category)
            .set({
              slug: input.slug,
              title: input.title,
              updatedBy: input.updatedBy,
              updatedAt: new Date(),
            })
            .where(and(eq(category.id, id), sameVersion(category.updatedAt, input.expectedVersion)))
            .returning({ id: category.id, updatedAt: category.updatedAt });
          if (!row) return resolveRejectedUpdate(tx, category, id);
          await auditEditorialWrite(
            tx,
            input.updatedBy,
            "editorial.write",
            "help.category.update",
            "help_category",
            row.id,
          );
          return { status: "updated" as const, version: row.updatedAt.toISOString() };
        }),
      ),

    setCategoryPublication: (id, published, updatedBy) =>
      db.transaction(async (tx) => {
        const [row] = await tx
          .update(category)
          .set({ status: published ? "published" : "draft", updatedBy, updatedAt: new Date() })
          .where(eq(category.id, id))
          .returning({ id: category.id });
        if (!row) return false;
        await auditEditorialWrite(
          tx,
          updatedBy,
          "editorial.publish",
          published ? "help.category.publish" : "help.category.unpublish",
          "help_category",
          row.id,
        );
        return true;
      }),

    deleteCategory: (id, actor) =>
      db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: category.id })
          .from(category)
          .where(eq(category.id, id))
          .for("update");
        if (!existing) return { status: "not_found" as const };
        const [children] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(article)
          .where(eq(article.categoryId, id));
        if ((children?.count ?? 0) > 0) return { status: "not_empty" as const };
        await tx.delete(category).where(eq(category.id, id));
        await auditEditorialWrite(
          tx,
          actor,
          "editorial.write",
          "help.category.delete",
          "help_category",
          id,
        );
        return { status: "ok" as const, value: null };
      }),

    reorderCategories: (ids, actor) =>
      db.transaction(async (tx) => {
        const rows = await tx.select({ id: category.id }).from(category).for("update");
        if (
          !sameIds(
            rows.map((row) => row.id),
            ids,
          )
        )
          return { status: "list_changed" as const };
        for (const [position, id] of ids.entries()) {
          await tx.update(category).set({ position }).where(eq(category.id, id));
        }
        await auditEditorialWrite(
          tx,
          actor,
          "editorial.write",
          "help.category.reorder",
          "help_category",
          "all",
          { ids },
        );
        return { status: "ok" as const, value: null };
      }),

    async listAdminArticles({ categoryId, status, q }) {
      const term = q?.trim();
      const pattern = term ? containsPattern(term) : null;
      const rows = await db
        .select({
          id: article.id,
          slug: article.slug,
          question: article.question,
          categoryId: article.categoryId,
          categoryTitle: category.title,
          position: article.position,
          status: article.status,
          updatedAt: article.updatedAt,
          updatedBy: article.updatedBy,
        })
        .from(article)
        .innerJoin(category, eq(category.id, article.categoryId))
        .where(
          and(
            categoryId ? eq(article.categoryId, categoryId) : undefined,
            status ? eq(article.status, status) : undefined,
            pattern
              ? or(ilike(article.question, pattern), ilike(article.answerText, pattern))
              : undefined,
          ),
        )
        .orderBy(asc(category.position), asc(article.position), asc(article.question))
        .limit(ADMIN_ARTICLE_LIST_LIMIT);
      return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
    },

    async getAdminArticleById(id) {
      const [row] = await db
        .select({
          id: article.id,
          slug: article.slug,
          question: article.question,
          categoryId: article.categoryId,
          categoryTitle: category.title,
          position: article.position,
          status: article.status,
          updatedAt: article.updatedAt,
          updatedBy: article.updatedBy,
          answerBlocks: article.answerBlocks,
          seoTitle: article.seoTitle,
          seoDescription: article.seoDescription,
        })
        .from(article)
        .innerJoin(category, eq(category.id, article.categoryId))
        .where(eq(article.id, id))
        .limit(1);
      if (!row) return null;
      const { answerBlocks, updatedAt, ...rest } = row;
      return { ...rest, updatedAt: updatedAt.toISOString(), body: readBlocks(answerBlocks) };
    },

    createArticle: (input) =>
      rethrowSlugConflict(
        db.transaction(async (tx) => {
          const answer = parseEditorialBlocks(input.body);
          const [parent] = await tx
            .select({ id: category.id })
            .from(category)
            .where(eq(category.id, input.categoryId))
            .for("share");
          if (!parent) return { status: "unknown_category" as const };
          const [last] = await tx
            .select({ next: sql<number>`coalesce(max(${article.position}) + 1, 0)::int` })
            .from(article)
            .where(eq(article.categoryId, input.categoryId));
          const [row] = await tx
            .insert(article)
            .values({
              categoryId: input.categoryId,
              slug: input.slug,
              question: input.question,
              answerBlocks: answer,
              answerText: editorialBlocksPlainText(answer),
              position: last?.next ?? 0,
              ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
              ...(input.seoDescription !== undefined
                ? { seoDescription: input.seoDescription }
                : {}),
              updatedBy: input.updatedBy,
            })
            .returning({ id: article.id });
          if (!row) throw new Error("help_article_create_failed");
          await auditEditorialWrite(
            tx,
            input.updatedBy,
            "editorial.write",
            "help.article.create",
            "help_article",
            row.id,
          );
          return { status: "ok" as const, value: { id: row.id } };
        }),
      ),

    updateArticle: (id, input) =>
      rethrowSlugConflict(
        db.transaction(async (tx) => {
          const answer = parseEditorialBlocks(input.body);
          const [current] = await tx
            .select({ categoryId: article.categoryId })
            .from(article)
            .where(eq(article.id, id))
            .limit(1);
          if (!current) return { status: "not_found" as const };
          const moved = current.categoryId !== input.categoryId;
          if (moved) {
            const [parent] = await tx
              .select({ id: category.id })
              .from(category)
              .where(eq(category.id, input.categoryId))
              .for("share");
            if (!parent) return { status: "unknown_category" as const };
          }
          const [last] = moved
            ? await tx
                .select({ next: sql<number>`coalesce(max(${article.position}) + 1, 0)::int` })
                .from(article)
                .where(eq(article.categoryId, input.categoryId))
            : [];
          const [row] = await tx
            .update(article)
            .set({
              categoryId: input.categoryId,
              slug: input.slug,
              question: input.question,
              answerBlocks: answer,
              answerText: editorialBlocksPlainText(answer),
              // A question moved to another category joins the end of that list.
              ...(moved ? { position: last?.next ?? 0 } : {}),
              ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
              ...(input.seoDescription !== undefined
                ? { seoDescription: input.seoDescription }
                : {}),
              updatedBy: input.updatedBy,
              updatedAt: new Date(),
            })
            .where(and(eq(article.id, id), sameVersion(article.updatedAt, input.expectedVersion)))
            .returning({ id: article.id, updatedAt: article.updatedAt });
          if (!row) return resolveRejectedUpdate(tx, article, id);
          await auditEditorialWrite(
            tx,
            input.updatedBy,
            "editorial.write",
            "help.article.update",
            "help_article",
            row.id,
          );
          return { status: "updated" as const, version: row.updatedAt.toISOString() };
        }),
      ),

    setArticlePublication: (id, published, updatedBy) =>
      db.transaction(async (tx) => {
        const [row] = await tx
          .update(article)
          .set({
            status: published ? "published" : "draft",
            publishedAt: published ? new Date() : null,
            updatedBy,
            updatedAt: new Date(),
          })
          .where(eq(article.id, id))
          .returning({ id: article.id });
        if (!row) return false;
        await auditEditorialWrite(
          tx,
          updatedBy,
          "editorial.publish",
          published ? "help.article.publish" : "help.article.unpublish",
          "help_article",
          row.id,
        );
        return true;
      }),

    deleteArticle: (id, actor) =>
      db.transaction(async (tx) => {
        const [row] = await tx
          .delete(article)
          .where(eq(article.id, id))
          .returning({ id: article.id });
        if (!row) return false;
        await auditEditorialWrite(
          tx,
          actor,
          "editorial.write",
          "help.article.delete",
          "help_article",
          row.id,
        );
        return true;
      }),

    reorderArticles: (categoryId, ids, actor) =>
      db.transaction(async (tx) => {
        const [parent] = await tx
          .select({ id: category.id })
          .from(category)
          .where(eq(category.id, categoryId))
          .for("update");
        if (!parent) return { status: "not_found" as const };
        const rows = await tx
          .select({ id: article.id })
          .from(article)
          .where(eq(article.categoryId, categoryId))
          .for("update");
        if (
          !sameIds(
            rows.map((row) => row.id),
            ids,
          )
        )
          return { status: "list_changed" as const };
        for (const [position, id] of ids.entries()) {
          await tx.update(article).set({ position }).where(eq(article.id, id));
        }
        await auditEditorialWrite(
          tx,
          actor,
          "editorial.write",
          "help.article.reorder",
          "help_category",
          categoryId,
          { ids },
        );
        return { status: "ok" as const, value: null };
      }),
  };
}

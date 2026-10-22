import { describe, expect, it, vi } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createEnquiryRateLimiter } from "../../application/enquiry-rate-limit.js";
import type { HelpRepository } from "../../application/ports/help.repository.js";
import { createInMemoryFixedWindowCounter } from "../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";
import { createStubEditorialLinksService } from "../../test-support/stub-editorial-links-service.js";
import { createStubEditorialRepository } from "../../test-support/stub-editorial-repository.js";
import { createStubEditorialSearchReader } from "../../test-support/stub-editorial-search-reader.js";
import { createStubHelpRepository } from "../../test-support/stub-help-repository.js";

async function buildApp(help: Partial<HelpRepository> = {}, editorialEnabled = true) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_EDITORIAL_ENABLED: editorialEnabled },
      editorial: {
        previewSecret: "test-preview-secret-minimum-32-chars",
        help: createStubHelpRepository(help),
        enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
        editorial: createStubEditorialRepository(),
        links: createStubEditorialLinksService(),
        search: createStubEditorialSearchReader(),
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

const summary = {
  slug: "how-do-i-pay",
  question: "How do I pay?",
  categorySlug: "buying",
  categoryTitle: "Buying",
};

describe("public help routes", () => {
  it("lists categories with their published question counts", async () => {
    const app = await buildApp({
      listCategories: async () => [{ slug: "buying", title: "Buying", articleCount: 3 }],
    });
    const res = await app.inject({ method: "GET", url: "/v1/help/categories" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [{ slug: "buying", title: "Buying", articleCount: 3 }] });
    await app.close();
  });

  it("passes the category and search term to the list", async () => {
    const listArticles = vi.fn(async () => [summary]);
    const app = await buildApp({ listArticles });
    const res = await app.inject({ method: "GET", url: "/v1/help/articles?category=buying&q=pay" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [summary] });
    expect(listArticles).toHaveBeenCalledWith({ categorySlug: "buying", q: "pay" });
    await app.close();
  });

  it("ignores a blank search term and rejects an over-long one", async () => {
    const listArticles = vi.fn(async () => []);
    const app = await buildApp({ listArticles });
    await app.inject({ method: "GET", url: "/v1/help/articles?q=%20%20" });
    expect(listArticles).toHaveBeenCalledWith({});
    const tooLong = await app.inject({
      method: "GET",
      url: `/v1/help/articles?q=${"a".repeat(121)}`,
    });
    expect(tooLong.statusCode).toBe(400);
    await app.close();
  });

  it("returns an answer with its blocks and SEO fields", async () => {
    const app = await buildApp({
      getArticleBySlug: async () => ({
        ...summary,
        answer: [{ type: "richText", spans: [{ text: "By card." }] }],
        updatedAt: "2026-01-02T00:00:00.000Z",
        seoTitle: null,
        seoDescription: "Paying for an artwork.",
      }),
    });
    const res = await app.inject({ method: "GET", url: "/v1/help/articles/how-do-i-pay" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      question: "How do I pay?",
      seoDescription: "Paying for an artwork.",
    });
    await app.close();
  });

  it("returns 404 for an unknown or unpublished question", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/help/articles/missing" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("is not served when editorial is disabled", async () => {
    const app = await buildApp({}, false);
    const res = await app.inject({ method: "GET", url: "/v1/help/categories" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

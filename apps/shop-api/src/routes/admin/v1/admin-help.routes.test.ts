import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createEnquiryRateLimiter } from "../../../application/enquiry-rate-limit.js";
import type { ArtCacheInvalidator } from "../../../application/ports/art-cache-invalidator.js";
import type { HelpRepository } from "../../../application/ports/help.repository.js";
import { createInMemoryFixedWindowCounter } from "../../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createStubEditorialLinksService } from "../../../test-support/stub-editorial-links-service.js";
import { createStubEditorialRepository } from "../../../test-support/stub-editorial-repository.js";
import { createStubEditorialSearchReader } from "../../../test-support/stub-editorial-search-reader.js";
import { createStubHelpRepository } from "../../../test-support/stub-help-repository.js";

const ARTICLE_ID = "44444444-4444-4444-8444-444444444444";
const CATEGORY_ID = "55555555-5555-4555-8555-555555555555";
const headers = { authorization: "Bearer admin-token-placeholder-minimum-length" };
const VERSION = "2026-01-02T00:00:00.000Z";

async function buildApp(
  help: Partial<HelpRepository> = {},
  artCache: ArtCacheInvalidator = {
    invalidateEditorial: async () => {},
    invalidateCatalogue: async () => {},
  },
) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: "editor-subject",
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_ADMIN_ENABLED: true,
        SHOP_EDITORIAL_ENABLED: true,
      },
      staffReader: {
        findActiveByIdentitySubject: async (subject) => ({
          roles: ["editor"],
          identitySubjectId: subject,
        }),
        brokerCanAccessClientParty: async () => false,
      },
      editorial: {
        previewSecret: "test-preview-secret-minimum-32-chars",
        help: createStubHelpRepository(help),
        links: createStubEditorialLinksService(),
        search: createStubEditorialSearchReader(),
        enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
        editorial: createStubEditorialRepository(),
        artCache,
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

const articleBody = {
  categoryId: CATEGORY_ID,
  slug: "how-do-i-pay",
  question: "How do I pay?",
  body: [{ type: "richText", spans: [{ text: "By card." }] }],
};

describe("admin help routes", () => {
  it("creates a question as the signed-in editor", async () => {
    const createArticle = vi.fn(async () => ({ status: "ok" as const, value: { id: ARTICLE_ID } }));
    const app = await buildApp({ createArticle });
    const res = await app.inject({
      method: "POST",
      url: "/admin/v1/help/articles",
      headers,
      payload: { ...articleBody, seoTitle: null },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: ARTICLE_ID });
    expect(createArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "how-do-i-pay",
        seoTitle: null,
        updatedBy: "editor-subject",
      }),
    );
    await app.close();
  });

  it("rejects a question for a category that does not exist", async () => {
    const app = await buildApp({ createArticle: async () => ({ status: "unknown_category" }) });
    const res = await app.inject({
      method: "POST",
      url: "/admin/v1/help/articles",
      headers,
      payload: articleBody,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("validates the slug and the answer blocks", async () => {
    const app = await buildApp();
    const badSlug = await app.inject({
      method: "POST",
      url: "/admin/v1/help/articles",
      headers,
      payload: { ...articleBody, slug: "Not A Slug" },
    });
    expect(badSlug.statusCode).toBe(400);
    await app.close();
  });

  it("saves an edit and returns the next version", async () => {
    const updateArticle = vi.fn(async () => ({ status: "updated" as const, version: VERSION }));
    const app = await buildApp({ updateArticle });
    const res = await app.inject({
      method: "PUT",
      url: `/admin/v1/help/articles/${ARTICLE_ID}`,
      headers,
      payload: { ...articleBody, expectedVersion: VERSION },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ version: VERSION });
    expect(updateArticle).toHaveBeenCalledWith(
      ARTICLE_ID,
      expect.objectContaining({ expectedVersion: VERSION, updatedBy: "editor-subject" }),
    );
    await app.close();
  });

  it("answers a stale save with 409 and the current version", async () => {
    const app = await buildApp({
      updateArticle: async () => ({ status: "stale", currentVersion: "2026-02-01T00:00:00.000Z" }),
    });
    const res = await app.inject({
      method: "PUT",
      url: `/admin/v1/help/articles/${ARTICLE_ID}`,
      headers,
      payload: { ...articleBody, expectedVersion: VERSION },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ currentVersion: "2026-02-01T00:00:00.000Z" });
    await app.close();
  });

  it("requires an expected version on update", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/admin/v1/help/articles/${ARTICLE_ID}`,
      headers,
      payload: articleBody,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 404 when publishing or deleting a missing question", async () => {
    const app = await buildApp({
      setArticlePublication: async () => false,
      deleteArticle: async () => false,
    });
    const publish = await app.inject({
      method: "POST",
      url: `/admin/v1/help/articles/${ARTICLE_ID}/publish`,
      headers,
    });
    expect(publish.statusCode).toBe(404);
    const remove = await app.inject({
      method: "DELETE",
      url: `/admin/v1/help/articles/${ARTICLE_ID}`,
      headers,
    });
    expect(remove.statusCode).toBe(404);
    await app.close();
  });

  it("refuses to delete a category that still has questions", async () => {
    const app = await buildApp({ deleteCategory: async () => ({ status: "not_empty" }) });
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/v1/help/categories/${CATEGORY_ID}`,
      headers,
    });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("reorders a list, and answers 409 when the list has changed", async () => {
    const reorderArticles = vi.fn(async () => ({ status: "list_changed" as const }));
    const app = await buildApp({ reorderArticles });
    const res = await app.inject({
      method: "PUT",
      url: `/admin/v1/help/categories/${CATEGORY_ID}/articles/order`,
      headers,
      payload: { ids: [ARTICLE_ID] },
    });
    expect(res.statusCode).toBe(409);
    expect(reorderArticles).toHaveBeenCalledWith(CATEGORY_ID, [ARTICLE_ID], "editor-subject");
    await app.close();
  });

  it("filters the question list by category, status and search term", async () => {
    const listAdminArticles = vi.fn(async () => []);
    const app = await buildApp({ listAdminArticles });
    const res = await app.inject({
      method: "GET",
      url: `/admin/v1/help/articles?categoryId=${CATEGORY_ID}&status=draft&q=pay`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(listAdminArticles).toHaveBeenCalledWith({
      categoryId: CATEGORY_ID,
      status: "draft",
      q: "pay",
    });
    await app.close();
  });

  it("tells lax.art to drop its cache after a committed help write", async () => {
    const invalidator = {
      invalidateCatalogue: vi.fn(async () => {}),
      invalidateEditorial: vi.fn(async () => {}),
    };
    const app = await buildApp({ setCategoryPublication: async () => true }, invalidator);
    const res = await app.inject({
      method: "POST",
      url: `/admin/v1/help/categories/${CATEGORY_ID}/publish`,
      headers,
    });
    expect(res.statusCode).toBe(204);
    await vi.waitFor(() => expect(invalidator.invalidateEditorial).toHaveBeenCalledTimes(1));
    await app.close();
  });
});

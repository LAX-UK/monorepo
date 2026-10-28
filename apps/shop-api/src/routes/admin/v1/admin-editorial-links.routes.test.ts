import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createEnquiryRateLimiter } from "../../../application/enquiry-rate-limit.js";
import type { EditorialLinksRepository } from "../../../application/ports/editorial-links.repository.js";
import { createInMemoryFixedWindowCounter } from "../../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createStubEditorialLinksService } from "../../../test-support/stub-editorial-links-service.js";
import { createStubEditorialRepository } from "../../../test-support/stub-editorial-repository.js";
import { createStubEditorialSearchReader } from "../../../test-support/stub-editorial-search-reader.js";
import { createStubHelpRepository } from "../../../test-support/stub-help-repository.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const PARENT = "44444444-4444-4444-8444-444444444444";
const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const headers = { authorization: `Bearer ${ADMIN_TOKEN}` };

async function buildApp(role: ShopStaffRole, links: Partial<EditorialLinksRepository> = {}) {
  vi.mocked(verifyBearerToken).mockResolvedValueOnce({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const baseEnv = createMinimalShopApiTestDeps().env;
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...baseEnv, SHOP_ADMIN_ENABLED: true, SHOP_EDITORIAL_ENABLED: true },
      staffReader: {
        findActiveByIdentitySubject: async (subject) => ({
          roles: [role],
          identitySubjectId: subject,
        }),
        brokerCanAccessClientParty: async () => false,
      },
      editorial: {
        previewSecret: "test-preview-secret-minimum-32-chars",
        help: createStubHelpRepository(),
        links: createStubEditorialLinksService(links),
        search: createStubEditorialSearchReader(),
        enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
        editorial: createStubEditorialRepository(),
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

const emptyExhibitionLinks = { artworks: [], artists: [], stories: [], version: "v1" };

describe("admin editorial links routes", () => {
  describe("capabilities", () => {
    const routes = [
      { method: "GET", url: `/admin/v1/editorial/exhibitions/${PARENT}/links` },
      { method: "GET", url: `/admin/v1/editorial/stories/${PARENT}/links` },
      {
        method: "PUT",
        url: `/admin/v1/editorial/exhibitions/${PARENT}/links/artworks`,
        payload: { ids: [], expectedVersion: "v1" },
      },
      {
        method: "PUT",
        url: `/admin/v1/editorial/stories/${PARENT}/links/artists`,
        payload: { ids: [], expectedVersion: "v1" },
      },
      { method: "GET", url: "/admin/v1/editorial/link-candidates?kind=story" },
    ] as const;

    it.each(routes)("forbids staff without editorial.write on $method $url", async (route) => {
      const app = await buildApp("operations");
      const response = await app.inject({ ...route, headers });
      expect(response.statusCode).toBe(403);
      await app.close();
    });

    it.each(routes)("rejects an unauthenticated $method $url", async (route) => {
      const app = await buildApp("editor");
      const response = await app.inject({ method: route.method, url: route.url });
      expect(response.statusCode).toBe(401);
      await app.close();
    });
  });

  describe("reads", () => {
    it("returns exhibition links with their version", async () => {
      const app = await buildApp("editor", {
        getExhibitionLinks: async () => emptyExhibitionLinks,
      });
      const response = await app.inject({
        method: "GET",
        url: `/admin/v1/editorial/exhibitions/${PARENT}/links`,
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(emptyExhibitionLinks);
      await app.close();
    });

    it.each(["exhibitions", "stories"])("returns 404 for a missing parent on %s", async (kind) => {
      const app = await buildApp("editor");
      const response = await app.inject({
        method: "GET",
        url: `/admin/v1/editorial/${kind}/${PARENT}/links`,
        headers,
      });
      expect(response.statusCode).toBe(404);
      await app.close();
    });

    it("rejects a malformed id", async () => {
      const app = await buildApp("editor");
      const response = await app.inject({
        method: "GET",
        url: "/admin/v1/editorial/exhibitions/not-a-uuid/links",
        headers,
      });
      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

  describe("writes", () => {
    it("replaces a list, passing the order, version and actor through", async () => {
      const replaceExhibitionLinks = vi.fn(async () => ({
        status: "replaced" as const,
        version: "v2",
      }));
      const app = await buildApp("editor", { replaceExhibitionLinks });
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/editorial/exhibitions/${PARENT}/links/artworks`,
        headers,
        payload: { ids: [ID_B, ID_A], expectedVersion: "v1" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ version: "v2" });
      expect(replaceExhibitionLinks).toHaveBeenCalledWith({
        parentId: PARENT,
        list: "artworks",
        ids: [ID_B, ID_A],
        expectedVersion: "v1",
        actorSubjectId: "editor-subject",
      });
      await app.close();
    });

    it("accepts the maximum of 200 ids, which exceeds the app-wide body cap", async () => {
      const replaceExhibitionLinks = vi.fn(async () => ({
        status: "replaced" as const,
        version: "v2",
      }));
      const app = await buildApp("editor", { replaceExhibitionLinks });
      const maxIds = Array.from(
        { length: 200 },
        (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
      );
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/editorial/exhibitions/${PARENT}/links/artworks`,
        headers,
        payload: { ids: maxIds, expectedVersion: "v1" },
      });
      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it("replaces a story list", async () => {
      const replaceStoryLinks = vi.fn(async () => ({
        status: "replaced" as const,
        version: "v2",
      }));
      const app = await buildApp("editor", { replaceStoryLinks });
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/editorial/stories/${PARENT}/links/exhibitions`,
        headers,
        payload: { ids: [ID_A], expectedVersion: "v1" },
      });
      expect(response.statusCode).toBe(200);
      expect(replaceStoryLinks).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: PARENT, list: "exhibitions", ids: [ID_A] }),
      );
      await app.close();
    });

    it.each([
      ["a duplicate id", { ids: [ID_A, ID_A], expectedVersion: "v1" }, "artworks"],
      [
        "a duplicate id differing in case",
        { ids: [ID_A, ID_A.toUpperCase()], expectedVersion: "v1" },
        "artworks",
      ],
      [
        "more than 200 ids",
        {
          ids: Array.from(
            { length: 201 },
            (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
          ),
          expectedVersion: "v1",
        },
        "artworks",
      ],
      ["a non-uuid id", { ids: ["nope"], expectedVersion: "v1" }, "artworks"],
      ["a missing expectedVersion", { ids: [ID_A] }, "artworks"],
      ["an unknown list", { ids: [ID_A], expectedVersion: "v1" }, "exhibitions"],
    ])("rejects %s with 400 and writes nothing", async (_name, payload, list) => {
      const replaceExhibitionLinks = vi.fn();
      const app = await buildApp("editor", { replaceExhibitionLinks });
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/editorial/exhibitions/${PARENT}/links/${list}`,
        headers,
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe(SHOP_API_ERROR_CODES.VALIDATION);
      expect(replaceExhibitionLinks).not.toHaveBeenCalled();
      await app.close();
    });

    it("returns 404 when the parent does not exist", async () => {
      const app = await buildApp("editor");
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/editorial/stories/${PARENT}/links/artworks`,
        headers,
        payload: { ids: [], expectedVersion: "v1" },
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe(SHOP_API_ERROR_CODES.NOT_FOUND);
      await app.close();
    });

    it("returns 409 with the current version for a stale write", async () => {
      const app = await buildApp("editor", {
        replaceExhibitionLinks: async () => ({ status: "stale", currentVersion: "v9" }),
      });
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/editorial/exhibitions/${PARENT}/links/artists`,
        headers,
        payload: { ids: [ID_A], expectedVersion: "v1" },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        code: SHOP_API_ERROR_CODES.CONFLICT,
        currentVersion: "v9",
      });
      await app.close();
    });

    it("returns 422 naming the missing ids", async () => {
      const app = await buildApp("editor", {
        replaceStoryLinks: async () => ({ status: "unknown_ids", missingIds: [ID_B] }),
      });
      const response = await app.inject({
        method: "PUT",
        url: `/admin/v1/editorial/stories/${PARENT}/links/artworks`,
        headers,
        payload: { ids: [ID_A, ID_B], expectedVersion: "v1" },
      });
      expect(response.statusCode).toBe(422);
      expect(response.json().missingIds).toEqual([ID_B]);
      await app.close();
    });
  });

  describe("candidates", () => {
    it("passes the search through with the default limit", async () => {
      const searchCandidates = vi.fn(async () => ({ items: [], nextCursor: null }));
      const app = await buildApp("editor", { searchCandidates });
      const response = await app.inject({
        method: "GET",
        url: "/admin/v1/editorial/link-candidates?kind=artist&q=%20theo%20",
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(searchCandidates).toHaveBeenCalledWith({
        kind: "artist",
        q: "theo",
        cursor: null,
        limit: 20,
      });
      await app.close();
    });

    it.each([
      ["an unknown kind", "kind=poster"],
      ["no kind", "q=x"],
      ["a limit above the maximum", "kind=story&limit=51"],
      ["a zero limit", "kind=story&limit=0"],
    ])("rejects %s", async (_name, query) => {
      const app = await buildApp("editor");
      const response = await app.inject({
        method: "GET",
        url: `/admin/v1/editorial/link-candidates?${query}`,
        headers,
      });
      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });
});

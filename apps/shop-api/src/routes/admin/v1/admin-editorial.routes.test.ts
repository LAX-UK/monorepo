import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createEnquiryRateLimiter } from "../../../application/enquiry-rate-limit.js";
import { createInMemoryFixedWindowCounter } from "../../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createStubEditorialLinksService } from "../../../test-support/stub-editorial-links-service.js";
import { createStubEditorialRepository } from "../../../test-support/stub-editorial-repository.js";
import { createStubEditorialSearchReader } from "../../../test-support/stub-editorial-search-reader.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";

function mockEnquiryReaderAuth() {
  vi.mocked(verifyBearerToken).mockResolvedValueOnce({
    subject: "audit-reader",
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
}

describe("admin editorial routes", () => {
  it("lists general enquiries for staff with enquiry.read", async () => {
    mockEnquiryReaderAuth();
    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_ADMIN_ENABLED: true,
        SHOP_EDITORIAL_ENABLED: true,
      },
      staffReader: {
        findActiveByIdentitySubject: async (s) =>
          s === "audit-reader" ? { role: "account_manager", identitySubjectId: s } : null,
        brokerCanAccessClientParty: async () => false,
      },
      editorial: {
        previewSecret: "test-preview-secret-minimum-32-chars",
        links: createStubEditorialLinksService(),
        search: createStubEditorialSearchReader(),
        enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
        editorial: createStubEditorialRepository({
          listAdminGeneralEnquiries: async () => [
            {
              enquiryId: "11111111-1111-4111-8111-111111111111",
              identitySubjectId: "subject-1",
              contactName: null,
              contactEmail: null,
              topic: "general",
              contextSlug: null,
              message: "Hello",
              phone: null,
              createdAt: new Date("2026-01-01T12:00:00.000Z"),
            },
          ],
        }),
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const res = await app.inject({
      method: "GET",
      url: "/admin/v1/general-enquiries",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    await app.close();
  });

  it("passes SEO overrides through when an editor creates a page", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "editor",
      payload: {
        scope: "shop.admin",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000),
      },
    } as never);
    const createPage = vi.fn(async () => ({ id: "22222222-2222-4222-8222-222222222222" }));
    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_ADMIN_ENABLED: true,
        SHOP_EDITORIAL_ENABLED: true,
      },
      staffReader: {
        findActiveByIdentitySubject: async (s) => ({
          role: "catalogue_editor",
          identitySubjectId: s,
        }),
        brokerCanAccessClientParty: async () => false,
      },
      editorial: {
        previewSecret: "test-preview-secret-minimum-32-chars",
        links: createStubEditorialLinksService(),
        search: createStubEditorialSearchReader(),
        enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
        editorial: createStubEditorialRepository({ createPage }),
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const res = await app.inject({
      method: "POST",
      url: "/admin/v1/editorial/pages",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        slug: "about-us",
        title: "About us",
        body: [],
        seoTitle: "About LAX Art | London Gallery",
        seoDescription: null,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(createPage).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "about-us",
        seoTitle: "About LAX Art | London Gallery",
        seoDescription: null,
        updatedBy: "editor",
      }),
    );
    await app.close();
  });
  it("saves a podcast story with its new fields and returns them to the editor", async () => {
    const editorAuth = () =>
      vi.mocked(verifyBearerToken).mockResolvedValueOnce({
        subject: "editor",
        payload: {
          scope: "shop.admin",
          acr: OIDC_ACR_SILVER,
          auth_time: Math.floor(Date.now() / 1000),
        },
      } as never);
    const storyId = "33333333-3333-4333-8333-333333333333";
    const podcastFields = {
      category: "podcast" as const,
      authorName: "Clara Hutchins",
      readMinutes: null,
      series: "In the studio",
      episodeNumber: 4,
      audioUrl: "https://media.lax.art/podcast/episode-4.mp3",
      durationSeconds: 2760,
      publicationName: null,
      externalUrl: null,
    };
    const createStory = vi.fn(async () => ({ id: storyId }));
    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_ADMIN_ENABLED: true,
        SHOP_EDITORIAL_ENABLED: true,
      },
      staffReader: {
        findActiveByIdentitySubject: async (s) => ({
          role: "catalogue_editor",
          identitySubjectId: s,
        }),
        brokerCanAccessClientParty: async () => false,
      },
      editorial: {
        previewSecret: "test-preview-secret-minimum-32-chars",
        links: createStubEditorialLinksService(),
        search: createStubEditorialSearchReader(),
        enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
        editorial: createStubEditorialRepository({
          createStory,
          getAdminStoryById: async () => ({
            id: storyId,
            slug: "episode-4",
            status: "draft",
            label: "Episode 4",
            kind: "podcast",
            title: "Episode 4",
            standfirst: null,
            coverMediaKey: null,
            videoUrl: null,
            featured: false,
            body: [],
            seoTitle: null,
            seoDescription: null,
            ...podcastFields,
          }),
        }),
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    editorAuth();
    const created = await app.inject({
      method: "POST",
      url: "/admin/v1/editorial/stories",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        slug: "episode-4",
        kind: "podcast",
        title: "Episode 4",
        standfirst: null,
        coverMediaKey: null,
        videoUrl: null,
        featured: false,
        body: [],
        ...podcastFields,
      },
    });
    expect(created.statusCode).toBe(201);
    expect(createStory).toHaveBeenCalledWith(expect.objectContaining(podcastFields));
    editorAuth();
    const read = await app.inject({
      method: "GET",
      url: `/admin/v1/editorial/stories/${storyId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({ kind: "podcast", ...podcastFields });
    await app.close();
  });
});

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
import { createStubHelpRepository } from "../../../test-support/stub-help-repository.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";

describe("admin editorial routes", () => {
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
        help: createStubHelpRepository(),
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
        seoTitle: "About lax.art | London Gallery",
        seoDescription: null,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(createPage).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "about-us",
        seoTitle: "About lax.art | London Gallery",
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
        help: createStubHelpRepository(),
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
            updatedAt: "2026-01-01T00:00:00.000Z",
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

describe("entity saves are versioned", () => {
  const ENTITY_ID = "44444444-4444-4444-8444-444444444444";
  const VERSION = "2026-03-01T10:00:00.000Z";
  const CURRENT = "2026-03-01T11:30:00.000Z";
  const exhibitionBody = {
    slug: "summer-show",
    kind: "exhibition",
    title: "Summer show",
    summary: null,
    venueId: null,
    startsOn: null,
    endsOn: null,
    timesNote: null,
    coverMediaKey: null,
    featured: false,
    body: [],
    subtitle: "A subtitle",
    contactEmail: "curator@example.com",
  };

  async function putExhibition(
    updateExhibition: ReturnType<typeof vi.fn>,
    payload: Record<string, unknown>,
  ) {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "editor",
      payload: {
        scope: "shop.admin",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000),
      },
    } as never);
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
        help: createStubHelpRepository(),
        links: createStubEditorialLinksService(),
        search: createStubEditorialSearchReader(),
        enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
        editorial: createStubEditorialRepository({ updateExhibition } as never),
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const res = await app.inject({
      method: "PUT",
      url: `/admin/v1/editorial/exhibitions/${ENTITY_ID}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload,
    });
    await app.close();
    return res;
  }

  it("passes the expected version through and returns the new one", async () => {
    const updateExhibition = vi.fn(async () => ({ status: "updated", version: CURRENT }));
    const res = await putExhibition(updateExhibition, {
      ...exhibitionBody,
      expectedVersion: VERSION,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ version: CURRENT });
    expect(updateExhibition).toHaveBeenCalledWith(
      ENTITY_ID,
      expect.objectContaining({ expectedVersion: VERSION, subtitle: "A subtitle" }),
    );
  });

  it("answers 409 with the current version when the row has moved on", async () => {
    const updateExhibition = vi.fn(async () => ({ status: "stale", currentVersion: CURRENT }));
    const res = await putExhibition(updateExhibition, {
      ...exhibitionBody,
      expectedVersion: VERSION,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ currentVersion: CURRENT });
  });

  it("answers 404 when the exhibition no longer exists", async () => {
    const updateExhibition = vi.fn(async () => ({ status: "not_found" }));
    const res = await putExhibition(updateExhibition, {
      ...exhibitionBody,
      expectedVersion: VERSION,
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects a save without an expected version before touching the repository", async () => {
    const updateExhibition = vi.fn();
    const res = await putExhibition(updateExhibition, exhibitionBody);
    expect(res.statusCode).toBe(400);
    expect(updateExhibition).not.toHaveBeenCalled();
  });

  it("rejects an expected version that is not a timestamp", async () => {
    const updateExhibition = vi.fn();
    const res = await putExhibition(updateExhibition, {
      ...exhibitionBody,
      expectedVersion: "yesterday",
    });
    expect(res.statusCode).toBe(400);
    expect(updateExhibition).not.toHaveBeenCalled();
  });
});

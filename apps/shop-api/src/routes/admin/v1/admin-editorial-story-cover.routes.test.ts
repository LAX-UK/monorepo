import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createEnquiryRateLimiter } from "../../../application/enquiry-rate-limit.js";
import type { EditorialStoryAdminDetail } from "../../../application/ports/editorial.repository.js";
import { createInMemoryFixedWindowCounter } from "../../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createStubEditorialLinksService } from "../../../test-support/stub-editorial-links-service.js";
import { createStubEditorialRepository } from "../../../test-support/stub-editorial-repository.js";
import { createStubEditorialSearchReader } from "../../../test-support/stub-editorial-search-reader.js";
import { createStubHelpRepository } from "../../../test-support/stub-help-repository.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const STORY_ID = "33333333-3333-4333-8333-333333333333";
const COVER = "shop/editorial-cover/welcome.jpg";

function story(overrides: Partial<EditorialStoryAdminDetail> = {}): EditorialStoryAdminDetail {
  return {
    id: STORY_ID,
    slug: "welcome",
    status: "draft",
    label: "Welcome to lax.art",
    updatedAt: "2026-01-01T00:00:00.000Z",
    kind: "article",
    title: "Welcome to lax.art",
    standfirst: null,
    coverMediaKey: null,
    videoUrl: null,
    featured: false,
    body: [],
    seoTitle: null,
    seoDescription: null,
    category: null,
    authorName: null,
    readMinutes: null,
    series: null,
    episodeNumber: null,
    audioUrl: null,
    durationSeconds: null,
    publicationName: null,
    externalUrl: null,
    ...overrides,
  };
}

function storyBody(overrides: Record<string, unknown> = {}) {
  return {
    slug: "welcome",
    kind: "article",
    title: "Welcome to lax.art",
    standfirst: null,
    coverMediaKey: null,
    videoUrl: null,
    featured: false,
    body: [],
    ...overrides,
  };
}

async function setup(stored: EditorialStoryAdminDetail) {
  const repo = {
    createStory: vi.fn(async () => ({ id: STORY_ID })),
    updateStory: vi.fn(async () => ({
      status: "updated" as const,
      version: "2026-01-02T00:00:00.000Z",
    })),
    setStoryPublication: vi.fn(async () => undefined),
    getAdminStoryById: vi.fn(async () => stored),
  };
  const deps = createMinimalShopApiTestDeps({
    env: {
      ...createMinimalShopApiTestDeps().env,
      SHOP_ADMIN_ENABLED: true,
      SHOP_EDITORIAL_ENABLED: true,
    },
    staffReader: {
      findActiveByIdentitySubject: async (s) => ({ roles: ["editor"], identitySubjectId: s }),
      brokerCanAccessClientParty: async () => false,
    },
    editorial: {
      previewSecret: "test-preview-secret-minimum-32-chars",
      help: createStubHelpRepository(),
      links: createStubEditorialLinksService(),
      search: createStubEditorialSearchReader(),
      enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
      editorial: createStubEditorialRepository(repo),
    },
  });
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  const call = (method: "POST" | "PUT", url: string, payload?: unknown) => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "editor",
      payload: {
        scope: "shop.admin",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000),
      },
    } as never);
    return app.inject({
      method,
      url: `/admin/v1/editorial/stories${url}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      ...(payload ? { payload: payload as object } : {}),
    });
  };
  return { app, repo, call };
}

describe("story cover rule on the admin routes", () => {
  it("refuses to publish a story without a cover, naming the cover field", async () => {
    const { app, repo, call } = await setup(story());
    const res = await call("POST", `/${STORY_ID}/publish`);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      code: SHOP_API_ERROR_CODES.STORY_COVER_REQUIRED,
      issues: [
        { field: "coverMediaKey", message: "Add a cover image before publishing this story." },
      ],
    });
    expect(repo.setStoryPublication).not.toHaveBeenCalled();
    await app.close();
  });

  it("publishes a story that has a cover", async () => {
    const { app, repo, call } = await setup(story({ coverMediaKey: COVER }));
    const res = await call("POST", `/${STORY_ID}/publish`);
    expect(res.statusCode).toBe(204);
    expect(repo.setStoryPublication).toHaveBeenCalledWith(STORY_ID, true, "editor");
    await app.close();
  });

  it("still lets a story be unpublished without a cover", async () => {
    const { app, repo, call } = await setup(story({ status: "published" }));
    const res = await call("POST", `/${STORY_ID}/unpublish`);
    expect(res.statusCode).toBe(204);
    expect(repo.setStoryPublication).toHaveBeenCalledWith(STORY_ID, false, "editor");
    await app.close();
  });

  it("refuses to feature a story without a cover on create and on save", async () => {
    const { app, repo, call } = await setup(story());
    const created = await call("POST", "", storyBody({ featured: true }));
    expect(created.statusCode).toBe(400);
    expect(created.json()).toMatchObject({
      code: SHOP_API_ERROR_CODES.STORY_COVER_REQUIRED,
      issues: [
        { field: "coverMediaKey", message: "Add a cover image before featuring this story." },
      ],
    });
    const saved = await call("PUT", `/${STORY_ID}`, {
      ...storyBody({ featured: true }),
      expectedVersion: "2026-01-01T00:00:00.000Z",
    });
    expect(saved.statusCode).toBe(400);
    expect(repo.createStory).not.toHaveBeenCalled();
    expect(repo.updateStory).not.toHaveBeenCalled();
    await app.close();
  });

  it("does not let a published story lose its cover", async () => {
    const { app, repo, call } = await setup(story({ status: "published", coverMediaKey: COVER }));
    const res = await call("PUT", `/${STORY_ID}`, {
      ...storyBody(),
      expectedVersion: "2026-01-01T00:00:00.000Z",
    });
    expect(res.statusCode).toBe(400);
    expect(repo.updateStory).not.toHaveBeenCalled();
    await app.close();
  });

  it("saves a draft without a cover", async () => {
    const { app, repo, call } = await setup(story());
    const res = await call("PUT", `/${STORY_ID}`, {
      ...storyBody(),
      expectedVersion: "2026-01-01T00:00:00.000Z",
    });
    expect(res.statusCode).toBe(200);
    expect(repo.updateStory).toHaveBeenCalled();
    await app.close();
  });
});

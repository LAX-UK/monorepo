import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createEnquiryRateLimiter } from "../../../application/enquiry-rate-limit.js";
import type { ArtCacheInvalidator } from "../../../application/ports/art-cache-invalidator.js";
import type { EditorialRepository } from "../../../application/ports/editorial.repository.js";
import { createInMemoryFixedWindowCounter } from "../../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createStubEditorialLinksService } from "../../../test-support/stub-editorial-links-service.js";
import { createStubEditorialRepository } from "../../../test-support/stub-editorial-repository.js";
import { createStubEditorialSearchReader } from "../../../test-support/stub-editorial-search-reader.js";
import { createStubHelpRepository } from "../../../test-support/stub-help-repository.js";

const PAGE_ID = "44444444-4444-4444-8444-444444444444";
const headers = { authorization: "Bearer admin-token-placeholder-minimum-length" };

async function buildApp(
  invalidator: ArtCacheInvalidator,
  repository: Partial<EditorialRepository> = {},
) {
  vi.mocked(verifyBearerToken).mockResolvedValueOnce({
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
          role: "catalogue_editor",
          identitySubjectId: subject,
        }),
        brokerCanAccessClientParty: async () => false,
      },
      editorial: {
        previewSecret: "test-preview-secret-minimum-32-chars",
        help: createStubHelpRepository(),
        links: createStubEditorialLinksService(),
        search: createStubEditorialSearchReader(),
        enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
        editorial: createStubEditorialRepository(repository),
        artCache: invalidator,
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

describe("lax.art cache invalidation on editorial writes", () => {
  it("notifies after a publish has been committed", async () => {
    const order: string[] = [];
    const invalidator = {
      invalidateEditorial: vi.fn(async () => {
        order.push("invalidated");
      }),
    };
    const app = await buildApp(invalidator, {
      setPagePublication: async () => {
        order.push("committed");
      },
    });
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/editorial/pages/${PAGE_ID}/publish`,
      headers,
    });
    expect(response.statusCode).toBe(204);
    await vi.waitFor(() => expect(invalidator.invalidateEditorial).toHaveBeenCalledTimes(1));
    expect(order).toEqual(["committed", "invalidated"]);
    await app.close();
  });

  it("does not notify when the write fails and rolls back", async () => {
    const invalidator = { invalidateEditorial: vi.fn(async () => {}) };
    const app = await buildApp(invalidator, {
      setPagePublication: async () => {
        throw new Error("transaction rolled back");
      },
    });
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/editorial/pages/${PAGE_ID}/publish`,
      headers,
    });
    expect(response.statusCode).toBe(500);
    await app.close();
    expect(invalidator.invalidateEditorial).not.toHaveBeenCalled();
  });

  it("keeps the staff response unchanged when the notification fails", async () => {
    const invalidator = {
      invalidateEditorial: vi.fn(async () => {
        throw new Error("lax.art unreachable");
      }),
    };
    const app = await buildApp(invalidator, { setPagePublication: async () => {} });
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/editorial/pages/${PAGE_ID}/unpublish`,
      headers,
    });
    expect(response.statusCode).toBe(204);
    await vi.waitFor(() => expect(invalidator.invalidateEditorial).toHaveBeenCalledTimes(1));
    await app.close();
  });

  it("notifies for placement writes", async () => {
    const invalidator = { invalidateEditorial: vi.fn(async () => {}) };
    const app = await buildApp(invalidator, { replacePlacementSlot: async () => {} });
    const response = await app.inject({
      method: "PUT",
      url: "/admin/v1/editorial/placements/home_hero",
      headers,
      payload: { items: [] },
    });
    expect(response.statusCode).toBe(204);
    await vi.waitFor(() => expect(invalidator.invalidateEditorial).toHaveBeenCalledTimes(1));
    await app.close();
  });

  it("does not notify for reads or preview-token signing", async () => {
    const invalidator = { invalidateEditorial: vi.fn(async () => {}) };
    const app = await buildApp(invalidator);
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "editor-subject",
      payload: {
        scope: "shop.admin",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000),
      },
    } as never);
    const preview = await app.inject({
      method: "POST",
      url: "/admin/v1/editorial/preview-token",
      headers,
      payload: { entity: "page", id: PAGE_ID },
    });
    expect(preview.statusCode).toBe(200);
    await app.close();
    expect(invalidator.invalidateEditorial).not.toHaveBeenCalled();
  });
});

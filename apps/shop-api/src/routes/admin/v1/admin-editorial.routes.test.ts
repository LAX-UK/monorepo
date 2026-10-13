import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createStubEditorialRepository } from "../../../test-support/stub-editorial-repository.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";

function mockAuditReaderAuth() {
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
  it("lists general enquiries for audit readers", async () => {
    mockAuditReaderAuth();
    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_ADMIN_ENABLED: true,
        SHOP_EDITORIAL_ENABLED: true,
      },
      staffReader: {
        findActiveByIdentitySubject: async (s) =>
          s === "audit-reader" ? { role: "finance", identitySubjectId: s } : null,
        brokerCanAccessClientParty: async () => false,
      },
      editorial: {
        previewSecret: "test-preview-secret-minimum-32-chars",
        editorial: createStubEditorialRepository({
          listAdminGeneralEnquiries: async () => [
            {
              enquiryId: "11111111-1111-4111-8111-111111111111",
              identitySubjectId: "subject-1",
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
});

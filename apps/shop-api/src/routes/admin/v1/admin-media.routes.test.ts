import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createShopMediaUploadHandlers } from "../../../application/handlers/shop-media-upload.handler.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createFakeObjectStorage } from "../../../test-support/fake-object-storage.js";
import { createMemoryShopMediaAssetRepository } from "../../../test-support/memory-shop-media-asset.repository.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

function mockCatalogueEditorAuth() {
  vi.mocked(verifyBearerToken).mockResolvedValueOnce({
    subject: "catalogue-editor",
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
}

describe("admin media routes", () => {
  it("returns 503 when media uploads are not configured", async () => {
    mockCatalogueEditorAuth();
    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_ADMIN_ENABLED: true,
      },
      staffReader: {
        findActiveByIdentitySubject: async (s) =>
          s === "catalogue-editor" ? { roles: ["catalogue_editor"], identitySubjectId: s } : null,
        brokerCanAccessClientParty: async () => false,
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/media/presign",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { kind: "artwork_image", contentType: "image/png", byteSize: 100 },
    });
    expect(response.statusCode).toBe(503);
    await app.close();
  });

  it("presigns and confirms for catalogue editors", async () => {
    mockCatalogueEditorAuth();
    mockCatalogueEditorAuth();
    const storage = createFakeObjectStorage();
    const repository = createMemoryShopMediaAssetRepository();
    const handlers = createShopMediaUploadHandlers({
      storage,
      repository,
      imageProbe: {
        analyze: async () => ({ width: 1, height: 1 }),
        makeLqip: async () => "data:image/webp;base64,x",
      },
    });

    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_ADMIN_ENABLED: true,
      },
      staffReader: {
        findActiveByIdentitySubject: async (s) =>
          s === "catalogue-editor" ? { roles: ["catalogue_editor"], identitySubjectId: s } : null,
        brokerCanAccessClientParty: async () => false,
      },
    });
    deps.admin.shopMediaUpload = handlers;

    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const presign = await app.inject({
      method: "POST",
      url: "/admin/v1/media/presign",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        kind: "artwork_image",
        contentType: "image/png",
        byteSize: PNG_HEADER.byteLength,
      },
    });
    expect(presign.statusCode).toBe(200);
    const { key, uploadUrl } = presign.json() as { key: string; uploadUrl: string };
    expect(uploadUrl).toContain(key);

    await storage.putObject(key, PNG_HEADER, "image/png");

    const confirm = await app.inject({
      method: "POST",
      url: "/admin/v1/media/confirm",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { key },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json()).toMatchObject({ key, width: 1, height: 1 });
    await app.close();
  });
});

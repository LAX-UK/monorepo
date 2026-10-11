import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createImportArtworkHandler } from "../../../application/handlers/import-artwork.handler.js";
import type { ImportArtworkCommand } from "../../../application/ports/artwork-import.writer.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const headers = {
  authorization: "Bearer admin-token-placeholder-minimum-length",
  "idempotency-key": "import-artwork-key-1",
};

const baseBody = {
  importKey: "admin:import:1",
  slug: "harbour-at-dusk",
  title: "Harbour at Dusk",
  description: null,
  primaryImageUrl: null,
  artistSlug: "ada-artist",
  artistDisplayName: "Ada Artist",
  eligibleForEditionAllocation: false,
};

async function buildApp() {
  const importArtwork = vi.fn(async (_command: ImportArtworkCommand) => ({
    artworkId: "00000000-0000-4000-8000-000000000001",
    created: true,
    editionCount: 0,
  }));
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_ADMIN_ENABLED: true },
      staffReader: {
        findActiveByIdentitySubject: async (subject) => ({
          role: "catalogue_editor" as const,
          identitySubjectId: subject,
        }),
        brokerCanAccessClientParty: async () => false,
      },
      admin: {
        ...base.admin,
        importArtwork: createImportArtworkHandler({ importArtwork }),
      },
    }),
    logger: false,
  });
  await app.ready();
  return { app, importArtwork };
}

describe("admin artwork import route medium", () => {
  beforeEach(() => {
    vi.mocked(verifyBearerToken).mockResolvedValue({
      subject: "catalogue-subject",
      payload: {
        scope: "shop.admin",
        acr: OIDC_ACR_SILVER,
        auth_time: Math.floor(Date.now() / 1000),
      },
    } as never);
  });

  it("forwards a trimmed medium to the import writer", async () => {
    const { app, importArtwork } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/artworks/import",
      headers,
      payload: { ...baseBody, medium: "  Oil on linen  " },
    });
    expect(response.statusCode).toBe(200);
    expect(importArtwork).toHaveBeenCalledWith(expect.objectContaining({ medium: "Oil on linen" }));
    await app.close();
  });

  it("passes an explicit null to clear medium and omits it when absent", async () => {
    const { app, importArtwork } = await buildApp();
    await app.inject({
      method: "POST",
      url: "/admin/v1/artworks/import",
      headers,
      payload: { ...baseBody, medium: null },
    });
    expect(importArtwork).toHaveBeenLastCalledWith(expect.objectContaining({ medium: null }));

    await app.inject({
      method: "POST",
      url: "/admin/v1/artworks/import",
      headers: { ...headers, "idempotency-key": "import-artwork-key-2" },
      payload: baseBody,
    });
    expect(importArtwork.mock.lastCall?.[0]).not.toHaveProperty("medium");
    await app.close();
  });

  it("rejects a medium longer than 200 characters", async () => {
    const { app, importArtwork } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/artworks/import",
      headers,
      payload: { ...baseBody, medium: "x".repeat(201) },
    });
    expect(response.statusCode).toBe(400);
    expect(importArtwork).not.toHaveBeenCalled();
    await app.close();
  });
});

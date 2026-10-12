import { verifyBearerToken } from "@auction/auth/token-verifier";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "collector-1",
    payload: { scope: "shop.read shop.write" },
  })),
}));

import { createShopApiApp } from "../../app.js";
import type { EditorialRepository } from "../../application/ports/editorial.repository.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";
import { createStubEditorialRepository } from "../../test-support/stub-editorial-repository.js";

const userHeaders = { authorization: "Bearer user-token" };
const ENQUIRY_ID = "6f1c1f0e-7f1a-4a43-9a51-0c1b1d2e3f40";

async function buildApp(overrides: Partial<EditorialRepository> = {}) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_EDITORIAL_ENABLED: true },
      editorial: {
        previewSecret: "test-preview-secret-minimum-32-chars",
        editorial: createStubEditorialRepository(overrides),
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

describe("editorial routes", () => {
  afterEach(() => {
    vi.mocked(verifyBearerToken).mockClear();
  });

  it("returns home placements when editorial is enabled", async () => {
    const app = await buildApp({
      getHomePlacements: async () => [
        {
          slot: "home_hero",
          position: 0,
          headline: "Welcome",
          mediaUrl: null,
          linkUrl: null,
          refKind: "external",
          refSlug: null,
        },
      ],
    });
    const res = await app.inject({ method: "GET", url: "/v1/editorial/home" });
    expect(res.statusCode).toBe(200);
    expect(res.json().placements).toHaveLength(1);
    await app.close();
  });

  it("requires a bearer token to submit a general enquiry", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/me/general-enquiries",
      payload: { topic: "general", message: "Hello" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("requires shop.write to submit a general enquiry", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "collector-1",
      payload: { scope: "shop.read" },
    } as never);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/me/general-enquiries",
      headers: userHeaders,
      payload: { topic: "general", message: "Hello" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("stores a signed-in collector's enquiry with blank optional fields as null", async () => {
    const insertGeneralEnquiry = vi.fn(async () => ({ enquiryId: ENQUIRY_ID }));
    const app = await buildApp({ insertGeneralEnquiry });
    const res = await app.inject({
      method: "POST",
      url: "/v1/me/general-enquiries",
      headers: userHeaders,
      payload: {
        topic: "private_viewing",
        message: "  Viewing please  ",
        contextSlug: " ",
        phone: "",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ enquiryId: ENQUIRY_ID });
    expect(insertGeneralEnquiry).toHaveBeenCalledWith({
      identitySubjectId: "collector-1",
      topic: "private_viewing",
      contextSlug: null,
      message: "Viewing please",
      phone: null,
    });
    await app.close();
  });

  it("rejects a whitespace-only enquiry message", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/me/general-enquiries",
      headers: userHeaders,
      payload: { topic: "general", message: "   " },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

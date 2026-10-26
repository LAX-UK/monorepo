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
import { createInMemoryFixedWindowCounter } from "../../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createStubEditorialLinksService } from "../../../test-support/stub-editorial-links-service.js";
import { createStubEditorialRepository } from "../../../test-support/stub-editorial-repository.js";
import { createStubEditorialSearchReader } from "../../../test-support/stub-editorial-search-reader.js";
import { createStubHelpRepository } from "../../../test-support/stub-help-repository.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const ENTITY_ID = "44444444-4444-4444-8444-444444444444";
const IDEMPOTENCY_KEY = "77777777-7777-4777-8777-777777777777";

const ALL_ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
];

type Probe = {
  name: string;
  method: "GET" | "POST" | "PUT";
  url: string;
  payload?: unknown;
  allowed: ShopStaffRole[];
};

const PROBES: Probe[] = [
  {
    name: "editorial read",
    method: "GET",
    url: "/admin/v1/editorial/pages",
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "editorial create",
    method: "POST",
    url: "/admin/v1/editorial/pages",
    payload: { slug: "about", title: "About", body: [] },
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "editorial update",
    method: "PUT",
    url: `/admin/v1/editorial/pages/${ENTITY_ID}`,
    payload: {
      slug: "about",
      title: "About",
      body: [],
      expectedVersion: "2026-01-01T00:00:00.000Z",
    },
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "editorial publish",
    method: "POST",
    url: `/admin/v1/editorial/pages/${ENTITY_ID}/publish`,
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "editorial unpublish",
    method: "POST",
    url: `/admin/v1/editorial/stories/${ENTITY_ID}/unpublish`,
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "editorial placement write",
    method: "PUT",
    url: "/admin/v1/editorial/placements/home_hero",
    payload: { items: [] },
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "editorial preview token",
    method: "POST",
    url: "/admin/v1/editorial/preview-token",
    payload: { entity: "page", id: ENTITY_ID },
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "enquiry inbox list",
    method: "GET",
    url: "/admin/v1/enquiries",
    allowed: ["shop_admin", "account_manager", "broker", "operations"],
  },
  {
    name: "orders list",
    method: "GET",
    url: "/admin/v1/orders",
    allowed: ["shop_admin", "account_manager", "operations", "finance"],
  },
  {
    name: "editorial links read",
    method: "GET",
    url: `/admin/v1/editorial/exhibitions/${ENTITY_ID}/links`,
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "editorial links write",
    method: "PUT",
    url: `/admin/v1/editorial/exhibitions/${ENTITY_ID}/links/artworks`,
    payload: { ids: [], expectedVersion: "v1" },
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "editorial link candidates",
    method: "GET",
    url: "/admin/v1/editorial/link-candidates?kind=artist",
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "help categories list",
    method: "GET",
    url: "/admin/v1/help/categories",
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "help article publish",
    method: "POST",
    url: `/admin/v1/help/articles/${ENTITY_ID}/publish`,
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "help category reorder",
    method: "PUT",
    url: "/admin/v1/help/categories/order",
    payload: { ids: [ENTITY_ID] },
    allowed: ["shop_admin", "catalogue_editor"],
  },
  {
    name: "artists list",
    method: "GET",
    url: "/admin/v1/artists",
    allowed: ["shop_admin", "catalogue_editor"],
  },
];

function buildApp(
  role: ShopStaffRole,
  options: {
    authAgeSeconds?: number;
    editorial?: Parameters<typeof createStubEditorialRepository>[0];
  } = {},
) {
  vi.mocked(verifyBearerToken).mockResolvedValueOnce({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000) - (options.authAgeSeconds ?? 0),
    },
  } as never);
  const baseEnv = createMinimalShopApiTestDeps().env;
  const deps = createMinimalShopApiTestDeps({
    env: { ...baseEnv, SHOP_ADMIN_ENABLED: true, SHOP_EDITORIAL_ENABLED: true },
    staffReader: {
      findActiveByIdentitySubject: async (subject) => ({ role, identitySubjectId: subject }),
      brokerCanAccessClientParty: async () => false,
    },
    editorial: {
      previewSecret: "test-preview-secret-minimum-32-chars",
      help: createStubHelpRepository({
        setArticlePublication: async () => true,
        reorderCategories: async () => ({ status: "ok", value: null }),
      }),
      links: createStubEditorialLinksService({
        getExhibitionLinks: async () => ({ artworks: [], artists: [], stories: [], version: "v1" }),
        replaceExhibitionLinks: async () => ({ status: "replaced", version: "v2" }),
      }),
      search: createStubEditorialSearchReader(),
      enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
      editorial: createStubEditorialRepository({
        createPage: async () => ({ id: ENTITY_ID }),
        updatePage: async () => ({ status: "updated", version: "2026-01-02T00:00:00.000Z" }),
        setPagePublication: async () => undefined,
        setStoryPublication: async () => undefined,
        replacePlacementSlot: async () => undefined,
        ...options.editorial,
      }),
    },
  });
  return createShopApiApp({ deps, logger: false });
}

describe("admin route capabilities", () => {
  const cases = PROBES.flatMap((probe) =>
    ALL_ROLES.map((role) => ({ probe, role, allowed: probe.allowed.includes(role) })),
  );

  it.each(cases)("$probe.name as $role is allowed: $allowed", async ({ probe, role, allowed }) => {
    const app = buildApp(role);
    await app.ready();
    const response = await app.inject({
      method: probe.method,
      url: probe.url,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      ...(probe.payload !== undefined ? { payload: probe.payload as object } : {}),
    });
    if (allowed) {
      expect(response.statusCode).toBeLessThan(300);
    } else {
      expect(response.statusCode).toBe(403);
    }
    await app.close();
  });

  it("records the issuer of a preview token", async () => {
    const recordPreviewTokenIssued = vi.fn(async () => undefined);
    const app = buildApp("catalogue_editor", { editorial: { recordPreviewTokenIssued } });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/editorial/preview-token",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { entity: "page", id: ENTITY_ID },
    });
    expect(response.statusCode).toBe(200);
    expect(recordPreviewTokenIssued).toHaveBeenCalledWith(
      "page",
      ENTITY_ID,
      "catalogue_editor-subject",
    );
    await app.close();
  });
});

describe("staff role changes require recent authentication", () => {
  const grant = { method: "POST", url: "/admin/v1/staff/grants" } as const;
  const revoke = { method: "DELETE", url: "/admin/v1/staff/grants/subject-1" } as const;

  it.each([
    ["grant", grant],
    ["revoke", revoke],
  ])("rejects a %s with a stale sign-in", async (_name, request) => {
    const app = buildApp("shop_admin", { authAgeSeconds: 3600 });
    await app.ready();
    const response = await app.inject({
      ...request,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}`, "idempotency-key": IDEMPOTENCY_KEY },
      payload:
        request.method === "POST"
          ? { email: "new@example.com", role: "broker" }
          : { reason: "Left the team" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: SHOP_API_ERROR_CODES.STEP_UP_REQUIRED });
    await app.close();
  });

  it.each([
    ["grant", grant],
    ["revoke", revoke],
  ])("accepts a %s after a recent sign-in", async (_name, request) => {
    const app = buildApp("shop_admin", { authAgeSeconds: 30 });
    await app.ready();
    const response = await app.inject({
      ...request,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}`, "idempotency-key": IDEMPOTENCY_KEY },
      payload:
        request.method === "POST"
          ? { email: "new@example.com", role: "broker" }
          : { reason: "Left the team" },
    });
    expect(response.statusCode).toBeLessThan(300);
    await app.close();
  });

  it("still denies role changes to staff without settings.write", async () => {
    const app = buildApp("finance");
    await app.ready();
    const response = await app.inject({
      ...revoke,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}`, "idempotency-key": IDEMPOTENCY_KEY },
      payload: { reason: "Left the team" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: SHOP_API_ERROR_CODES.FORBIDDEN });
    await app.close();
  });

  it.each([
    ["no reason", {}],
    ["a blank reason", { reason: "       " }],
  ])("refuses to revoke access with %s", async (_name, payload) => {
    const app = buildApp("shop_admin", { authAgeSeconds: 30 });
    await app.ready();
    const response = await app.inject({
      ...revoke,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}`, "idempotency-key": IDEMPOTENCY_KEY },
      payload,
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

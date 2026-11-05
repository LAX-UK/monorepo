import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { ArtworkRegisterReviewService } from "../../../application/artwork-register/artwork-register-review.service.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const REGISTER_ID = "44444444-4444-4444-8444-444444444444";
const CONFLICT_ID = "55555555-5555-4555-8555-555555555555";
const T0 = new Date("2026-11-03T09:00:00.000Z");

const ALL_ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
  "editor",
  "read_only",
];
const CAN_READ: ShopStaffRole[] = ["shop_admin", "catalogue_editor", "read_only"];
const CAN_REVIEW: ShopStaffRole[] = ["shop_admin", "catalogue_editor"];

const resolved = {
  id: CONFLICT_ID,
  registerId: REGISTER_ID,
  field: "stockCode" as const,
  zohoValue: "LAX-ORI-PH-GAC-26-0099",
  laxValue: "LAX-ORI-PH-GAC-26-0001",
  status: "resolved" as const,
  resolution: "kept_lax" as const,
  resolvedBy: "staff:x",
  resolvedAt: T0,
  zohoModifiedAt: T0,
  detectedAt: T0,
};

type Resolve = ConstructorParameters<typeof ArtworkRegisterReviewService>[0]["resolver"];

async function buildApp(
  role: ShopStaffRole,
  resolveConflict: Resolve["resolveConflict"] = async () => ({ ok: true, conflict: resolved }),
) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const deps = createMinimalShopApiTestDeps({
    env: { ...createMinimalShopApiTestDeps().env, SHOP_ADMIN_ENABLED: true },
    staffReader: {
      findActiveByIdentitySubject: async (subject: string) => ({
        roles: [role],
        identitySubjectId: subject,
      }),
      brokerCanAccessClientParty: async () => false,
    },
  });
  deps.admin.artworkRegister = new ArtworkRegisterReviewService({
    queue: {
      listHeld: async () => ({ entries: [], total: 0 }),
      listOpenConflicts: async () => ({ items: [], total: 0 }),
      listConflictsFor: async () => [],
      countHeld: async () => 0,
      countOpenConflicts: async () => 0,
      listHeldArtists: async () => [],
    },
    register: {
      findById: async (id) => (id === REGISTER_ID ? null : null),
      listEvents: async () => [],
    },
    resolver: { resolveConflict },
    runs: { latestNightlyRun: async () => null },
    listingRuns: { latestRun: async () => null, countFailedDeliveries: async () => 0 },
    staffNames: { namesFor: async () => new Map() },
    listings: { findByZohoProductId: async () => null, findZohoProductId: async () => null },
  });
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return app;
}

const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };

describe("From Zoho queue capabilities", () => {
  const probes = [
    { name: "new list", method: "GET", url: "/admin/v1/artwork-register/new", allowed: CAN_READ },
    {
      name: "conflict list",
      method: "GET",
      url: "/admin/v1/artwork-register/conflicts",
      allowed: CAN_READ,
    },
    {
      name: "last check",
      method: "GET",
      url: "/admin/v1/artwork-register/last-check",
      allowed: CAN_READ,
    },
    {
      name: "resolve",
      method: "POST",
      url: `/admin/v1/artwork-register/conflicts/${CONFLICT_ID}/resolve`,
      payload: { resolution: "kept_lax" },
      allowed: CAN_REVIEW,
    },
  ] as const;

  for (const probe of probes) {
    for (const role of ALL_ROLES) {
      const allowed = probe.allowed.includes(role);
      it(`${allowed ? "lets" : "stops"} ${role} ${probe.name}`, async () => {
        const app = await buildApp(role);
        const response = await app.inject({
          method: probe.method,
          url: probe.url,
          headers: auth,
          ...("payload" in probe ? { payload: probe.payload } : {}),
        });
        expect(response.statusCode).toBe(allowed ? 200 : 403);
        await app.close();
      });
    }
  }
});

describe("From Zoho queue routes", () => {
  it("answers the lists with counts", async () => {
    const app = await buildApp("shop_admin");
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/artwork-register/new?artist=PH&missing=image&page=2",
      headers: auth,
    });
    expect(response.json()).toEqual({
      items: [],
      artists: [],
      total: 0,
      page: 2,
      pageSize: 25,
      counts: { new: 0, decisions: 0 },
    });
    await app.close();
  });

  it("refuses an unknown filter", async () => {
    const app = await buildApp("shop_admin");
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/artwork-register/new?missing=price",
      headers: auth,
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("says there is no artwork when the id is unknown", async () => {
    const app = await buildApp("read_only");
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/artwork-register/${REGISTER_ID}`,
      headers: auth,
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("records a decision under the signed-in staff member", async () => {
    const resolveConflict = vi.fn<Resolve["resolveConflict"]>(async () => ({
      ok: true,
      conflict: resolved,
    }));
    const app = await buildApp("catalogue_editor", resolveConflict);
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/artwork-register/conflicts/${CONFLICT_ID}/resolve`,
      headers: auth,
      payload: { resolution: "kept_lax" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      registerId: REGISTER_ID,
      conflict: { conflictId: CONFLICT_ID, status: "resolved", resolution: "kept_lax" },
    });
    expect(resolveConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictId: CONFLICT_ID,
        resolution: "kept_lax",
        resolvedBy: "staff:catalogue_editor-subject",
      }),
    );
    await app.close();
  });

  it("answers 409 when the conflict was already decided", async () => {
    const app = await buildApp("shop_admin", async () => ({
      ok: false,
      reason: "already_resolved",
    }));
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/artwork-register/conflicts/${CONFLICT_ID}/resolve`,
      headers: auth,
      payload: { resolution: "accepted_zoho" },
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it.each([
    ["invalid_stock_code", 409],
    ["stock_code_taken", 409],
    ["cannot_accept_field", 400],
  ] as const)("answers %s with a plain refusal", async (reason, status) => {
    const app = await buildApp("shop_admin", async () => ({ ok: false, reason }));
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/artwork-register/conflicts/${CONFLICT_ID}/resolve`,
      headers: auth,
      payload: { resolution: "accepted_zoho" },
    });
    expect(response.statusCode).toBe(status);
    expect(response.json().message).toMatch(/stock code|LAX/);
    await app.close();
  });

  it("answers 404 for an unknown conflict and refuses an unknown decision", async () => {
    const app = await buildApp("shop_admin", async () => ({ ok: false, reason: "not_found" }));
    const missing = await app.inject({
      method: "POST",
      url: `/admin/v1/artwork-register/conflicts/${CONFLICT_ID}/resolve`,
      headers: auth,
      payload: { resolution: "kept_lax" },
    });
    expect(missing.statusCode).toBe(404);
    const invalid = await app.inject({
      method: "POST",
      url: `/admin/v1/artwork-register/conflicts/${CONFLICT_ID}/resolve`,
      headers: auth,
      payload: { resolution: "delete_it" },
    });
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });
});

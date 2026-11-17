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

type Overview = ConstructorParameters<typeof ArtworkRegisterReviewService>[0]["overview"];

async function buildApp(
  role: ShopStaffRole | ShopStaffRole[],
  resolveConflict: Resolve["resolveConflict"] = async () => ({ ok: true, conflict: resolved }),
  listAll: Overview["listAll"] = async () => ({ rows: [], total: 0 }),
  options: {
    countConsignors?: Overview["countConsignors"];
    assignedParties?: string[];
  } = {},
) {
  const roles = Array.isArray(role) ? role : [role];
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${roles.join("+")}-subject`,
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
        roles,
        identitySubjectId: subject,
      }),
      brokerCanAccessClientParty: async () => false,
    },
  });
  deps.admin.staffReader = {
    ...deps.admin.staffReader,
    brokerCanAccessClientParty: async (_broker, partyId) =>
      (options.assignedParties ?? []).includes(partyId),
  };
  deps.admin.artworkRegister = new ArtworkRegisterReviewService({
    catalogueChanges: { changesFor: async () => [] },
    queue: {
      listHeld: async () => ({ entries: [], total: 0 }),
      listOpenConflicts: async () => ({ items: [], total: 0 }),
      listConflictsFor: async () => [],
      countHeld: async () => 0,
      countOpenConflicts: async () => 0,
      listHeldArtists: async () => [],
    },
    overview: {
      listAll,
      listArtists: async () => [],
      countPlaces: async () => ({
        not_offered: 0,
        draft_lax_art: 0,
        lax_art: 0,
        bid_sale: 0,
        private_sale: 0,
        withdrawn: 0,
        sold: 0,
      }),
      countConsignors: options.countConsignors ?? (async () => ({ none: 2, lax: 1, clients: [] })),
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
    auction: {
      assessRegister: async () => {
        throw new Error("assessRegister is not stubbed");
      },
    },
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
    { name: "all list", method: "GET", url: "/admin/v1/artwork-register/all", allowed: CAN_READ },
    {
      name: "queue counts",
      method: "GET",
      url: "/admin/v1/artwork-register/counts",
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

  it("orders the All list by Zoho's price on the server, and refuses an unknown order", async () => {
    const listAll = vi.fn<Overview["listAll"]>(async () => ({ rows: [], total: 0 }));
    const app = await buildApp("read_only", undefined, listAll);
    const sorted = await app.inject({
      method: "GET",
      url: "/admin/v1/artwork-register/all?sort=-zohoPrice&page=2",
      headers: auth,
    });
    expect(sorted.statusCode).toBe(200);
    expect(listAll).toHaveBeenCalledWith({}, { limit: 25, offset: 25 }, "-zohoPrice", undefined);
    const unknown = await app.inject({
      method: "GET",
      url: "/admin/v1/artwork-register/all?sort=title",
      headers: auth,
    });
    expect(unknown.statusCode).toBe(400);
    await app.close();
  });

  it("filters by consignor and says who consigned each work for people who keep agreements", async () => {
    const listAll = vi.fn<Overview["listAll"]>(async () => ({ rows: [], total: 0 }));
    const app = await buildApp("catalogue_editor", undefined, listAll);
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/artwork-register/all?consignor=lax",
      headers: auth,
    });
    expect(response.statusCode).toBe(200);
    expect(listAll).toHaveBeenCalledWith(
      { consignor: "lax" },
      { limit: 25, offset: 0 },
      undefined,
      { kind: "all" },
    );
    expect(response.json().consignors).toEqual([
      { value: "none", label: "Not set", count: 2 },
      { value: "lax", label: "LAX owns this work", count: 1 },
    ]);
    const unknown = await app.inject({
      method: "GET",
      url: "/admin/v1/artwork-register/all?consignor=someone",
      headers: auth,
    });
    expect(unknown.statusCode).toBe(400);
    await app.close();
  });

  it("leaves consignors out for Read-only and refuses them the consignor filter", async () => {
    const listAll = vi.fn<Overview["listAll"]>(async () => ({ rows: [], total: 0 }));
    const app = await buildApp("read_only", undefined, listAll);
    const plain = await app.inject({
      method: "GET",
      url: "/admin/v1/artwork-register/all",
      headers: auth,
    });
    expect(plain.statusCode).toBe(200);
    expect(plain.json()).not.toHaveProperty("consignors");
    const filtered = await app.inject({
      method: "GET",
      url: "/admin/v1/artwork-register/all?consignor=none",
      headers: auth,
    });
    expect(filtered.statusCode).toBe(403);
    expect(listAll).toHaveBeenCalledTimes(1);
    await app.close();
  });

  describe("for a broker who also reads the register", () => {
    // Broker reads consignors through client.read_assigned; Read-only opens the register.
    const BROKER_AND_READ_ONLY: ShopStaffRole[] = ["broker", "read_only"];
    const MINE = "22222222-2222-4222-8222-222222222222";
    const NOT_MINE = "33333333-3333-4333-8333-333333333333";
    const SUBJECT = "broker+read_only-subject";

    it("lists consignors among the clients assigned to them only", async () => {
      const listAll = vi.fn<Overview["listAll"]>(async () => ({ rows: [], total: 0 }));
      const countConsignors = vi.fn<Overview["countConsignors"]>(async () => ({
        none: 2,
        lax: 1,
        clients: [{ partyId: MINE, displayName: "Ivo Marren", count: 1 }],
      }));
      const app = await buildApp(BROKER_AND_READ_ONLY, undefined, listAll, {
        countConsignors,
        assignedParties: [MINE],
      });
      const response = await app.inject({
        method: "GET",
        url: "/admin/v1/artwork-register/all",
        headers: auth,
      });
      expect(response.statusCode).toBe(200);
      const scope = { kind: "assigned", brokerSubjectId: SUBJECT };
      expect(listAll).toHaveBeenCalledWith({}, { limit: 25, offset: 0 }, undefined, scope);
      expect(countConsignors).toHaveBeenCalledWith(scope);
      expect(response.json().consignors).toEqual([
        { value: "none", label: "Not set", count: 2 },
        { value: "lax", label: "LAX owns this work", count: 1 },
        { value: MINE, label: "Ivo Marren", count: 1 },
      ]);
      await app.close();
    });

    it("filters by an assigned client, LAX or none, and refuses any other client", async () => {
      const listAll = vi.fn<Overview["listAll"]>(async () => ({ rows: [], total: 0 }));
      const app = await buildApp(BROKER_AND_READ_ONLY, undefined, listAll, {
        assignedParties: [MINE],
      });
      const status = async (consignor: string) =>
        (
          await app.inject({
            method: "GET",
            url: `/admin/v1/artwork-register/all?consignor=${consignor}`,
            headers: auth,
          })
        ).statusCode;
      expect(await status(MINE)).toBe(200);
      expect(await status("lax")).toBe(200);
      expect(await status("none")).toBe(200);
      expect(await status(NOT_MINE)).toBe(403);
      expect(listAll).toHaveBeenCalledTimes(3);
      expect(listAll).not.toHaveBeenCalledWith(
        { consignor: NOT_MINE },
        expect.anything(),
        undefined,
        expect.anything(),
      );
      await app.close();
    });

    it("leaves the client scope out for people who keep agreements", async () => {
      const listAll = vi.fn<Overview["listAll"]>(async () => ({ rows: [], total: 0 }));
      const app = await buildApp(["catalogue_editor", "broker"], undefined, listAll);
      const response = await app.inject({
        method: "GET",
        url: `/admin/v1/artwork-register/all?consignor=${NOT_MINE}`,
        headers: auth,
      });
      expect(response.statusCode).toBe(200);
      expect(listAll).toHaveBeenCalledWith(
        { consignor: NOT_MINE },
        { limit: 25, offset: 0 },
        undefined,
        { kind: "all" },
      );
      await app.close();
    });
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

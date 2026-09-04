import { bulkLotDeleteConfirmationPhrase, lotDeleteConfirmationPhrase } from "@auction/validators";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { stubBiddingRouteServices } from "../testing/stub-bidding-route-services.js";
import { stubCatalogRouteServices } from "../testing/stub-catalog-route-services.js";
import { createLotRoutes } from "./lots.js";

describe("POST /lots/:id/delete", () => {
  const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const phrase = lotDeleteConfirmationPhrase("Test Lot");

  function appWithAuth(role: string, staffRole: string | null) {
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>();
    const softDelete = vi.fn();
    const bulkLots = vi.fn();
    const base = stubCatalogRouteServices();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      lotService: { getById: vi.fn(), bulkPublishOrCancel: vi.fn() },
      lotSoftDeleteService: { getDeleteEligibility: vi.fn() },
      saleService: { getById: vi.fn() },
      mediaUrlResolver: {},
      kycService: { isConfigured: () => false },
      requireSubmissionsLegalEntityContext: vi.fn(),
      redis: {},
      lotLifecycleQueryService: { getSnapshotsForLots: vi.fn() },
      catalogRoutes: stubCatalogRouteServices({
        lotLifecycleHttp: { ...base.lotLifecycleHttp, softDelete, bulkLots },
      }),
      bidding: stubBiddingRouteServices(),
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "staff-1",
        role,
        staffRole,

        scopes: ["bid.write"],
      }),
    };
    app.route("/lots", createLotRoutes(container, authenticator));
    return { app, softDelete, bulkLots };
  }

  it("returns 204 when staff with auction.manage deletes a lot", async () => {
    const { app, softDelete } = appWithAuth("staff", "auction_manager");
    softDelete.mockResolvedValue({ kind: "no_content" });

    const res = await app.request(`http://t/lots/${lotId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(204);
    expect(softDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "staff-1",
        role: "staff",
        lotId,
        confirmationPhrase: phrase,
        staffRole: "auction_manager",
      }),
    );
  });

  it("returns 403 for client role", async () => {
    const { AuthzError } = await import("../lib/errors.js");
    const { app, softDelete } = appWithAuth("client", null);
    softDelete.mockResolvedValue({
      kind: "err",
      error: new AuthzError("Only staff with auction.manage can delete lots", 403),
    });

    const res = await app.request(`http://t/lots/${lotId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(403);
  });

  it("returns 422 when lot cannot be deleted", async () => {
    const { LotError } = await import("../lib/errors.js");
    const { app, softDelete } = appWithAuth("staff", "auction_manager");
    softDelete.mockResolvedValue({
      kind: "err",
      error: new LotError("Cannot delete: lot has bids", 422),
    });

    const res = await app.request(`http://t/lots/${lotId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(422);
  });
});

describe("POST /lots/bulk soft_delete", () => {
  const lotIds = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
  const phrase = bulkLotDeleteConfirmationPhrase(2);

  function appWithAuth(role: string, staffRole: string | null) {
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>();
    const bulkLots = vi.fn();
    const base = stubCatalogRouteServices();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      lotService: { getById: vi.fn(), bulkPublishOrCancel: vi.fn() },
      lotSoftDeleteService: { getDeleteEligibility: vi.fn() },
      saleService: { getById: vi.fn() },
      mediaUrlResolver: {},
      kycService: { isConfigured: () => false },
      requireSubmissionsLegalEntityContext: vi.fn(),
      redis: {},
      lotLifecycleQueryService: { getSnapshotsForLots: vi.fn() },
      catalogRoutes: stubCatalogRouteServices({
        lotLifecycleHttp: { ...base.lotLifecycleHttp, bulkLots },
      }),
      bidding: stubBiddingRouteServices(),
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "staff-1",
        role,
        staffRole,

        scopes: ["bid.write"],
      }),
    };
    app.route("/lots", createLotRoutes(container, authenticator));
    return { app, bulkLots };
  }

  it("returns bulk result when staff soft-deletes draft lots", async () => {
    const { app, bulkLots } = appWithAuth("staff", "auction_manager");
    bulkLots.mockResolvedValue({
      kind: "ok",
      data: { attempted: 2, failed: 0, errors: [], orphanDraftSales: [] },
    });

    const res = await app.request("http://t/lots/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: lotIds, op: "soft_delete", confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { attempted: number } };
    expect(body.data.attempted).toBe(2);
  });
});

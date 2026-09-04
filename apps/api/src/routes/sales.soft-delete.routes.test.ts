import {
  bulkSaleDeleteConfirmationPhrase,
  saleDeleteConfirmationPhrase,
} from "@auction/validators";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { stubCatalogRouteServices } from "../testing/stub-catalog-route-services.js";
import { createSaleRoutes } from "./sales.js";

describe("POST /sales/:id/delete", () => {
  const saleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const phrase = saleDeleteConfirmationPhrase("Test Sale");

  function appWithAuth(role: string, staffRole: string | null) {
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>();
    const softDelete = vi.fn();
    const bulkSoftDelete = vi.fn();
    const base = stubCatalogRouteServices();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      saleService: {},
      saleSoftDeleteService: { getDeleteEligibility: vi.fn() },
      saleFollowService: {},
      saleBiddersService: { list: vi.fn() },
      mediaUrlResolver: {},
      kycService: { isConfigured: () => false },
      catalogRoutes: stubCatalogRouteServices({
        saleLifecycleHttp: { ...base.saleLifecycleHttp, softDelete, bulkSoftDelete },
      }),
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "staff-1",
        role,
        staffRole,

        scopes: ["bid.write"],
      }),
    };
    app.route("/sales", createSaleRoutes(container, authenticator));
    return { app, softDelete, bulkSoftDelete };
  }

  it("returns 204 when staff with auction.manage deletes a sale", async () => {
    const { app, softDelete } = appWithAuth("staff", "auction_manager");
    softDelete.mockResolvedValue({ kind: "no_content" });

    const res = await app.request(`http://t/sales/${saleId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(204);
    expect(softDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "staff-1",
        role: "staff",
        saleId,
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
      error: new AuthzError("Only staff with auction.manage can delete sales", 403),
    });

    const res = await app.request(`http://t/sales/${saleId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(403);
  });

  it("returns 422 when sale cannot be deleted", async () => {
    const { LotError } = await import("../lib/errors.js");
    const { app, softDelete } = appWithAuth("staff", "auction_manager");
    softDelete.mockResolvedValue({
      kind: "err",
      error: new LotError("Cannot delete: lots in this sale have bids", 422),
    });

    const res = await app.request(`http://t/sales/${saleId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(422);
  });
});

describe("POST /sales/bulk soft_delete", () => {
  const saleIds = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
  const phrase = bulkSaleDeleteConfirmationPhrase(2);

  function appWithAuth(role: string, staffRole: string | null) {
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>();
    const bulkSoftDelete = vi.fn();
    const base = stubCatalogRouteServices();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      saleService: {},
      saleSoftDeleteService: { getDeleteEligibility: vi.fn() },
      saleFollowService: {},
      saleBiddersService: { list: vi.fn() },
      mediaUrlResolver: {},
      kycService: { isConfigured: () => false },
      catalogRoutes: stubCatalogRouteServices({
        saleLifecycleHttp: { ...base.saleLifecycleHttp, bulkSoftDelete },
      }),
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "staff-1",
        role,
        staffRole,

        scopes: ["bid.write"],
      }),
    };
    app.route("/sales", createSaleRoutes(container, authenticator));
    return { app, bulkSoftDelete };
  }

  it("returns bulk result when staff soft-deletes draft sales", async () => {
    const { app, bulkSoftDelete } = appWithAuth("staff", "auction_manager");
    bulkSoftDelete.mockResolvedValue({
      kind: "ok",
      data: { attempted: 2, failed: 0, errors: [] },
    });

    const res = await app.request("http://t/sales/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: saleIds, op: "soft_delete", confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { attempted: number } };
    expect(body.data.attempted).toBe(2);
  });

  it("returns 403 when bulk delete is unauthorized", async () => {
    const { AuthzError } = await import("../lib/errors.js");
    const { app, bulkSoftDelete } = appWithAuth("client", null);
    bulkSoftDelete.mockResolvedValue({
      kind: "err",
      error: new AuthzError("Only staff with auction.manage can delete sales", 403),
    });

    const res = await app.request("http://t/sales/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: saleIds, op: "soft_delete", confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(403);
  });
});

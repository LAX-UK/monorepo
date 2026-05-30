import { bulkLotDeleteConfirmationPhrase, lotDeleteConfirmationPhrase } from "@auction/validators";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createLotRoutes } from "./lots.js";

describe("POST /lots/:id/delete", () => {
  const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const phrase = lotDeleteConfirmationPhrase("Test Lot");

  function appWithAuth(role: string, staffRole: string | null) {
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>();
    const softDelete = vi.fn();
    const bulkSoftDelete = vi.fn();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      lotService: { getById: vi.fn(), bulkPublishOrCancel: vi.fn() },
      lotSoftDeleteService: { softDelete, bulkSoftDelete, getDeleteEligibility: vi.fn() },
      saleService: { getById: vi.fn() },
      mediaUrlResolver: {},
      kycService: { isConfigured: () => false },
      requireSubmissionsLegalEntityContext: vi.fn(),
      redis: {},
      lotLifecycleQueryService: { getSnapshotsForLots: vi.fn() },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "staff-1",
        role,
        staffRole,
      }),
    };
    app.route("/lots", createLotRoutes(container, authenticator));
    return { app, softDelete, bulkSoftDelete };
  }

  it("returns 204 when staff with auction.manage deletes a lot", async () => {
    const { app, softDelete } = appWithAuth("staff", "auction_manager");
    softDelete.mockResolvedValue({ isOk: () => true, isErr: () => false, value: undefined });

    const res = await app.request(`http://t/lots/${lotId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(204);
    expect(softDelete).toHaveBeenCalledWith("staff-1", "staff", lotId, phrase, "auction_manager");
  });
});

describe("POST /lots/bulk soft_delete", () => {
  const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const phrase = bulkLotDeleteConfirmationPhrase(1);

  function appWithAuth(role: string, staffRole: string | null) {
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>();
    const bulkSoftDelete = vi.fn();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      lotService: { getById: vi.fn(), bulkPublishOrCancel: vi.fn() },
      lotSoftDeleteService: { softDelete: vi.fn(), bulkSoftDelete, getDeleteEligibility: vi.fn() },
      saleService: { getById: vi.fn() },
      mediaUrlResolver: {},
      kycService: { isConfigured: () => false },
      requireSubmissionsLegalEntityContext: vi.fn(),
      redis: {},
      lotLifecycleQueryService: { getSnapshotsForLots: vi.fn() },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "staff-1",
        role,
        staffRole,
      }),
    };
    app.route("/lots", createLotRoutes(container, authenticator));
    return { app, bulkSoftDelete };
  }

  it("returns bulk result when staff soft-deletes draft lots", async () => {
    const { ok } = await import("neverthrow");
    const { app, bulkSoftDelete } = appWithAuth("staff", "auction_manager");
    bulkSoftDelete.mockResolvedValue(
      ok({
        attempted: 1,
        failed: 0,
        errors: [],
        orphanDraftSales: [],
      }),
    );

    const res = await app.request("http://t/lots/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [lotId],
        op: "soft_delete",
        confirmationPhrase: phrase,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { attempted: number; failed: number; orphanDraftSales: unknown[] };
    };
    expect(body.data.attempted).toBe(1);
    expect(body.data.failed).toBe(0);
    expect(bulkSoftDelete).toHaveBeenCalledWith(
      "staff-1",
      "staff",
      [lotId],
      phrase,
      "auction_manager",
    );
  });

  it("returns 400 when confirmation phrase is missing", async () => {
    const { app, bulkSoftDelete } = appWithAuth("staff", "auction_manager");

    const res = await app.request("http://t/lots/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [lotId],
        op: "soft_delete",
      }),
    });

    expect(res.status).toBe(400);
    expect(bulkSoftDelete).not.toHaveBeenCalled();
  });
});

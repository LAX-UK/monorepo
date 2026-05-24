import { saleDeleteConfirmationPhrase } from "@auction/validators";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createSaleRoutes } from "./sales.js";

describe("POST /sales/:id/delete", () => {
  const saleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const phrase = saleDeleteConfirmationPhrase("Test Sale");

  function appWithAuth(role: string, staffRole: string | null) {
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>();
    const softDelete = vi.fn();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      saleService: {},
      saleSoftDeleteService: { softDelete, getDeleteEligibility: vi.fn() },
      saleFollowService: {},
      saleBiddersService: { list: vi.fn() },
      mediaUrlResolver: {},
      kycService: { isConfigured: () => false },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "staff-1",
        role,
        staffRole,
      }),
    };
    app.route("/sales", createSaleRoutes(container, authenticator));
    return { app, softDelete };
  }

  it("returns 204 when staff with auction.manage deletes a sale", async () => {
    const { app, softDelete } = appWithAuth("staff", "auction_manager");
    softDelete.mockResolvedValue({ isOk: () => true, isErr: () => false, value: undefined });

    const res = await app.request(`http://t/sales/${saleId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(204);
    expect(softDelete).toHaveBeenCalledWith("staff-1", "staff", saleId, phrase, "auction_manager");
  });

  it("returns 403 for client role", async () => {
    const { err } = await import("neverthrow");
    const { AuthzError } = await import("../lib/errors.js");
    const { app, softDelete } = appWithAuth("client", null);
    softDelete.mockResolvedValue(
      err(new AuthzError("Only staff with auction.manage can delete sales", 403)),
    );

    const res = await app.request(`http://t/sales/${saleId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(403);
  });

  it("returns 422 when sale cannot be deleted", async () => {
    const { err } = await import("neverthrow");
    const { LotError } = await import("../lib/errors.js");
    const { app, softDelete } = appWithAuth("staff", "auction_manager");
    softDelete.mockResolvedValue(
      err(new LotError("Cannot delete: lots in this sale have bids", 422)),
    );

    const res = await app.request(`http://t/sales/${saleId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: phrase }),
    });

    expect(res.status).toBe(422);
  });

  it("returns 400 when confirmation phrase is missing", async () => {
    const { app } = appWithAuth("staff", "auction_manager");

    const res = await app.request(`http://t/sales/${saleId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

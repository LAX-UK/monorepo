import { lotDeleteConfirmationPhrase } from "@auction/validators";
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
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      lotService: { getById: vi.fn() },
      lotSoftDeleteService: { softDelete, getDeleteEligibility: vi.fn() },
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
    return { app, softDelete };
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

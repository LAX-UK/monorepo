import { describe, expect, it, vi } from "vitest";
import { UserSecurityHttpApplicationService } from "./user-security-http-application.service.js";

describe("UserSecurityHttpApplicationService", () => {
  describe("requestAccountDeletion", () => {
    const BLOCKER = {
      code: "account_deletion_pending_payments",
      message: "You have a payment still to make.",
      href: "https://bid.example/dashboard/payments",
    };
    const SHOP_BLOCKER = {
      code: "shop_open_orders",
      message: "You have an order that has not been delivered.",
      href: "https://shop.example/account/orders",
    };

    function setup(outcome: unknown) {
      const deleteAttribution = vi.fn().mockResolvedValue(undefined);
      const requestAccountDeletion = vi.fn().mockResolvedValue(outcome);
      const svc = new UserSecurityHttpApplicationService({
        sessionRevocation: {} as never,
        authAuditPublisher: {} as never,
        userService: { requestAccountDeletion } as never,
        attributionStore: { delete: deleteAttribution } as never,
      });
      return { svc, deleteAttribution, requestAccountDeletion };
    }

    it("hands the request to Identity's orchestration and clears attribution once it is accepted", async () => {
      const { svc, deleteAttribution, requestAccountDeletion } = setup({
        outcome: "requested",
        requestedAt: "2026-10-23T12:00:00.000Z",
      });
      const response = await svc.requestAccountDeletion({ userId: "u1" });
      expect(response).toEqual({ status: 200, body: { ok: true } });
      expect(requestAccountDeletion).toHaveBeenCalledWith("u1");
      expect(deleteAttribution).toHaveBeenCalledWith("u1");
    });

    it("keeps the attribution when something is in the way, and keeps the old error shape", async () => {
      const { svc, deleteAttribution } = setup({
        outcome: "not_eligible",
        status: {
          requestedAt: null,
          products: [
            { product: "bid", state: "blocked", blockers: [BLOCKER] },
            { product: "shop", state: "blocked", blockers: [SHOP_BLOCKER] },
          ],
        },
      });
      const response = await svc.requestAccountDeletion({ userId: "u1" });
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        error: BLOCKER.message,
        code: "account_deletion_pending_payments",
        blockers: [
          { ...BLOCKER, product: "bid" },
          { ...SHOP_BLOCKER, product: "shop" },
        ],
      });
      expect(deleteAttribution).not.toHaveBeenCalled();
    });

    it("tells the person to try again when a product could not be asked", async () => {
      const { svc, deleteAttribution } = setup({
        outcome: "not_eligible",
        status: {
          requestedAt: null,
          products: [
            { product: "bid", state: "clear", blockers: [] },
            { product: "shop", state: "unavailable", blockers: [] },
          ],
        },
      });
      const response = await svc.requestAccountDeletion({ userId: "u1" });
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: "account_deletion_check_unavailable" });
      expect(JSON.stringify(response.body)).toContain("try again");
      expect(deleteAttribution).not.toHaveBeenCalled();
    });

    it("reports a deletion that was already requested", async () => {
      const { svc, deleteAttribution } = setup({
        outcome: "already_requested",
        requestedAt: "2026-10-01T09:00:00.000Z",
      });
      const response = await svc.requestAccountDeletion({ userId: "u1" });
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: "account_deletion_already_requested" });
      expect(deleteAttribution).not.toHaveBeenCalled();
    });
  });
});

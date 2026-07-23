import { describe, expect, it, vi } from "vitest";
import { UserSecurityHttpApplicationService } from "./user-security-http-application.service.js";

describe("UserSecurityHttpApplicationService", () => {
  it("returns 200 when two-factor enabled notify mail enqueue fails after commit path", async () => {
    const enqueue = vi.fn().mockRejectedValue(new Error("mail down"));
    const svc = new UserSecurityHttpApplicationService({
      sessionRevocation: {} as never,
      authAuditPublisher: { publish: vi.fn().mockResolvedValue(undefined) } as never,
      userSecurityReadService: {
        getTwoFactorEnabled: vi.fn().mockResolvedValue(true),
      } as never,
      userService: {
        getById: vi.fn().mockResolvedValue({ id: "u1", email: "a@b.com", name: "Ada" }),
      } as never,
      emailService: { enqueue } as never,
      accountDeletionEligibilityService: {} as never,
      attributionStore: {} as never,
    });

    const response = await svc.notifyTwoFactorEnabled({ userId: "u1" });

    expect(response.status).toBe(200);
    expect(enqueue).toHaveBeenCalled();
  });

  it("deletes attribution before recording an account deletion request", async () => {
    const deleteAttribution = vi.fn().mockResolvedValue(undefined);
    const requestAccountDeletion = vi.fn().mockResolvedValue(undefined);
    const svc = new UserSecurityHttpApplicationService({
      sessionRevocation: {} as never,
      authAuditPublisher: {} as never,
      userSecurityReadService: {} as never,
      userService: { requestAccountDeletion } as never,
      emailService: {} as never,
      accountDeletionEligibilityService: {
        check: vi.fn().mockResolvedValue({ ok: true }),
      } as never,
      attributionStore: { delete: deleteAttribution } as never,
    });

    const response = await svc.requestAccountDeletion({ userId: "u1" });

    expect(response.status).toBe(200);
    expect(deleteAttribution).toHaveBeenCalledWith("u1");
    expect(requestAccountDeletion).toHaveBeenCalledWith("u1");
    expect(deleteAttribution.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER).toBeLessThan(
      requestAccountDeletion.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
  });
});

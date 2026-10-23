import { describe, expect, it, vi } from "vitest";
import { UserSecurityHttpApplicationService } from "./user-security-http-application.service.js";

describe("UserSecurityHttpApplicationService", () => {
  it("deletes attribution before recording an account deletion request", async () => {
    const deleteAttribution = vi.fn().mockResolvedValue(undefined);
    const requestAccountDeletion = vi.fn().mockResolvedValue(undefined);
    const svc = new UserSecurityHttpApplicationService({
      sessionRevocation: {} as never,
      authAuditPublisher: {} as never,
      userService: { requestAccountDeletion } as never,
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

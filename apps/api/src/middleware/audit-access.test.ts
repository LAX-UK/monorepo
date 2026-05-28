import { describe, expect, it, vi } from "vitest";
import { createAuditAccessMiddleware } from "./audit-access.js";

describe("createAuditAccessMiddleware", () => {
  it("logs successful access after handler completes", async () => {
    const info = vi.fn();
    const middleware = createAuditAccessMiddleware({ info } as never);
    const next = vi.fn().mockResolvedValue(undefined);
    const c = {
      get: (key: string) => (key === "userId" ? "admin-1" : key === "userStaffRole" ? "super_admin" : undefined),
      req: {
        method: "GET",
        path: "/admin/system/job-queues",
        header: (name: string) => (name === "x-request-id" ? "req-123" : undefined),
      },
    };
    await middleware(c as never, next as never);
    expect(next).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        method: "GET",
        path: "/admin/system/job-queues",
        requestId: "req-123",
      }),
      "bullmq_admin_access",
    );
  });
});

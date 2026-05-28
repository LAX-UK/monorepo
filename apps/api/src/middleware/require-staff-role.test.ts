import { describe, expect, it, vi } from "vitest";
import { requireSuperAdminStaffRole } from "./require-staff-role.js";

describe("requireSuperAdminStaffRole", () => {
  it("returns 403 for non-super-admin staff", async () => {
    const next = vi.fn();
    const json = vi.fn((body: unknown, status?: number) => ({ body, status }));
    const c = {
      get: (key: string) => (key === "userStaffRole" ? "auction_manager" : undefined),
      json,
    };
    await requireSuperAdminStaffRole(c as never, next as never);
    expect(json).toHaveBeenCalledWith({ error: "Forbidden" }, 403);
    expect(next).not.toHaveBeenCalled();
  });
});

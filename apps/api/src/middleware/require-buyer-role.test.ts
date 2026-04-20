import { describe, expect, it, vi } from "vitest";
import { createRequireBuyerRole, createRequireBuyerRoleUnlessAdmin } from "./require-buyer-role.js";
import type { RoleSource } from "./role-source.js";

function roleSource(role: string | null): RoleSource {
  return {
    getRole: () => role,
  };
}

describe("createRequireBuyerRole", () => {
  it("returns 403 when role is admin", async () => {
    const mw = createRequireBuyerRole(roleSource("admin"));
    const json = vi.fn((body: unknown, status?: number) => ({ body, status }));
    const next = vi.fn();
    const c = { get: vi.fn(), json } as unknown as Parameters<typeof mw>[0];
    (c.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
      key === "userRole" ? "admin" : undefined,
    );
    await mw(c, next as never);
    expect(json).toHaveBeenCalledWith({ error: "admin_cannot_buy" }, 403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when role is user", async () => {
    const mw = createRequireBuyerRole(roleSource("user"));
    const json = vi.fn();
    const next = vi.fn();
    const c = { get: vi.fn(), json } as unknown as Parameters<typeof mw>[0];
    (c.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
      key === "userRole" ? "user" : undefined,
    );
    await mw(c, next as never);
    expect(json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe("createRequireBuyerRoleUnlessAdmin", () => {
  it("skips buyer gate for admin", async () => {
    const mw = createRequireBuyerRoleUnlessAdmin(roleSource("admin"));
    const json = vi.fn();
    const next = vi.fn();
    const c = { get: vi.fn(), json } as unknown as Parameters<typeof mw>[0];
    (c.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
      key === "userRole" ? "admin" : undefined,
    );
    await mw(c, next as never);
    expect(json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

});

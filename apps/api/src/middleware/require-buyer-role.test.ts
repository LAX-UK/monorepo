import { describe, expect, it, vi } from "vitest";
import { createRequireBuyerRole, createRequireBuyerRoleUnlessStaff } from "./require-buyer-role.js";
import type { RoleSource } from "./role-source.js";

function roleSource(role: string | null): RoleSource {
  return {
    getRole: () => role,
  };
}

describe("createRequireBuyerRole", () => {
  it("returns 403 when role is administrator", async () => {
    const mw = createRequireBuyerRole(roleSource("administrator"));
    const json = vi.fn((body: unknown, status?: number) => ({ body, status }));
    const next = vi.fn();
    const c = { get: vi.fn(), json } as unknown as Parameters<typeof mw>[0];
    (c.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
      key === "userRole" ? "administrator" : undefined,
    );
    await mw(c, next as never);
    expect(json).toHaveBeenCalledWith({ error: "bidding_not_allowed_for_role" }, 403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when role is accountant", async () => {
    const mw = createRequireBuyerRole(roleSource("accountant"));
    const json = vi.fn();
    const next = vi.fn();
    const c = { get: vi.fn(), json } as unknown as Parameters<typeof mw>[0];
    (c.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
      key === "userRole" ? "accountant" : undefined,
    );
    await mw(c, next as never);
    expect(json).toHaveBeenCalledWith({ error: "bidding_not_allowed_for_role" }, 403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when role is client", async () => {
    const mw = createRequireBuyerRole(roleSource("client"));
    const json = vi.fn();
    const next = vi.fn();
    const c = { get: vi.fn(), json } as unknown as Parameters<typeof mw>[0];
    (c.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
      key === "userRole" ? "client" : undefined,
    );
    await mw(c, next as never);
    expect(json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe("createRequireBuyerRoleUnlessStaff", () => {
  it("skips buyer gate for staff", async () => {
    const mw = createRequireBuyerRoleUnlessStaff(roleSource("staff"));
    const json = vi.fn();
    const next = vi.fn();
    const c = { get: vi.fn(), json } as unknown as Parameters<typeof mw>[0];
    (c.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
      key === "userRole" ? "staff" : undefined,
    );
    await mw(c, next as never);
    expect(json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("does not skip buyer gate when role does not normalize to staff", async () => {
    const mw = createRequireBuyerRoleUnlessStaff(roleSource("not-a-platform-role"));
    const json = vi.fn();
    const next = vi.fn();
    const c = { get: vi.fn(), json } as unknown as Parameters<typeof mw>[0];
    (c.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
      key === "userRole" ? "not-a-platform-role" : undefined,
    );
    await mw(c, next as never);
    expect(json).toHaveBeenCalledWith({ error: "bidding_not_allowed_for_role" }, 403);
    expect(next).not.toHaveBeenCalled();
  });
});

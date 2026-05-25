import { mapAuthSessionUser } from "@/lib/auth/map-auth-session-user";
import { describe, expect, it } from "vitest";

describe("mapAuthSessionUser", () => {
  it("maps extended auth fields including staffRole", () => {
    const user = mapAuthSessionUser({
      id: "u1",
      email: "staff@example.com",
      name: "Staff User",
      role: "staff",
      staffRole: "catalogue_manager",
      suspended: true,
      twoFactorEnabled: true,
      emailVerified: true,
      image: "https://example.com/a.png",
    });

    expect(user).toMatchObject({
      id: "u1",
      email: "staff@example.com",
      name: "Staff User",
      role: "staff",
      staffRole: "catalogue_manager",
      suspended: true,
      twoFactorEnabled: true,
      emailVerified: true,
      image: "https://example.com/a.png",
    });
  });

  it("falls back to email when name is empty or whitespace", () => {
    expect(mapAuthSessionUser({ id: "u1", email: "a@b.com", name: "   " }).name).toBe("a@b.com");
    expect(mapAuthSessionUser({ id: "u1", email: "a@b.com", name: null }).name).toBe("a@b.com");
  });

  it("normalizes unknown role to client", () => {
    expect(mapAuthSessionUser({ id: "u1", email: "a@b.com", role: "unknown" }).role).toBe("client");
  });

  it("omits optional fields when absent", () => {
    const user = mapAuthSessionUser({ id: "u1", email: "a@b.com" });
    expect(user.staffRole).toBeUndefined();
    expect(user.suspended).toBeUndefined();
    expect(user.twoFactorEnabled).toBeUndefined();
    expect(user.emailVerified).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { parseSessionUser } from "./session.parse";

describe("parseSessionUser", () => {
  it.each([true, false])("preserves securityStatusAvailable=%s", (available) => {
    expect(
      parseSessionUser({
        id: "u1",
        email: "client@example.com",
        securityStatusAvailable: available,
        twoFactorEnabled: false,
      }),
    ).toMatchObject({
      securityStatusAvailable: available,
      twoFactorEnabled: false,
    });
  });

  it("reads the LAX Account time zone choice", () => {
    const base = { id: "u1", email: "client@example.com" };
    expect(
      parseSessionUser({ ...base, timeZone: { mode: "fixed", zone: "Asia/Tokyo" } }).timeZone,
    ).toEqual({ mode: "fixed", zone: "Asia/Tokyo" });
    expect(
      parseSessionUser({ ...base, timeZone: { mode: "automatic", zone: null } }).timeZone,
    ).toEqual({ mode: "automatic", zone: null });
  });

  it("ignores a time zone choice it does not recognise", () => {
    const base = { id: "u1", email: "client@example.com" };
    expect(
      parseSessionUser({ ...base, timeZone: { mode: "later", zone: "Asia/Tokyo" } }).timeZone,
    ).toBeUndefined();
    expect(parseSessionUser(base).timeZone).toBeUndefined();
  });

  it("does not invent availability when the field is absent", () => {
    expect(
      parseSessionUser({ id: "u1", email: "client@example.com" }).securityStatusAvailable,
    ).toBeUndefined();
  });

  it("keeps the roles in force for permissions and the single role for display", () => {
    const user = parseSessionUser({
      id: "u1",
      email: "staff@example.com",
      role: "staff",
      staffRole: "specialist",
      staffRoles: ["client_services", "specialist", "not_a_role", 7],
    });
    expect(user.staffRole).toBe("specialist");
    expect(user.staffRoles).toEqual(["specialist", "client_services"]);
  });

  it("falls back to the single role when the API does not send staffRoles yet", () => {
    const base = { id: "u1", email: "staff@example.com" };
    expect(parseSessionUser({ ...base, role: "staff", staffRole: "finance" }).staffRoles).toEqual([
      "finance",
    ]);
    expect(parseSessionUser({ ...base, role: "staff" }).staffRoles).toEqual([]);
    expect(parseSessionUser({ ...base, role: "client" }).staffRoles).toEqual([]);
  });

  it("trusts staffRoles when the API sends them, even if empty", () => {
    expect(
      parseSessionUser({
        id: "u1",
        email: "staff@example.com",
        role: "staff",
        staffRole: "administrator",
        staffRoles: [],
      }).staffRoles,
    ).toEqual([]);
  });
});

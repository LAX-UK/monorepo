import { describe, expect, it } from "vitest";
import { adminUserDetailRowSchema } from "./admin-users.schema";

describe("adminUserDetailRowSchema", () => {
  it.each([true, false])("preserves detail securityStatusAvailable=%s", (available) => {
    const detail = adminUserDetailRowSchema.parse({
      id: "u1",
      email: "client@example.com",
      name: "Client",
      securityStatusAvailable: available,
      twoFactorEnabled: false,
    });

    expect(detail.securityStatusAvailable).toBe(available);
    expect(detail.twoFactorEnabled).toBe(false);
  });

  it("treats missing availability as unavailable", () => {
    const detail = adminUserDetailRowSchema.parse({
      id: "u1",
      email: "client@example.com",
      name: "Client",
      twoFactorEnabled: false,
    });

    expect(detail.securityStatusAvailable).toBe(false);
  });

  it("keeps sign-in method kinds and reads a missing or malformed answer as not available", () => {
    const base = { id: "u1", email: "client@example.com", name: "Client" };
    const kinds = { password: true, google: false, apple: true, passkeys: 1 };

    expect(
      adminUserDetailRowSchema.parse({ ...base, signInMethodKinds: kinds }).signInMethodKinds,
    ).toEqual(kinds);
    expect(adminUserDetailRowSchema.parse(base).signInMethodKinds).toBeNull();
    expect(
      adminUserDetailRowSchema.parse({ ...base, signInMethodKinds: { password: "yes" } })
        .signInMethodKinds,
    ).toBeNull();
  });
});

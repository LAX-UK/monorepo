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
});

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

  it("does not invent availability when the field is absent", () => {
    expect(
      parseSessionUser({ id: "u1", email: "client@example.com" }).securityStatusAvailable,
    ).toBeUndefined();
  });
});

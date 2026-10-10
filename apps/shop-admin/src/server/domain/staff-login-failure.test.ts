import { IdentityRejectedError, IdentityUnavailableError } from "@auction/identity-rp";
import { describe, expect, it } from "vitest";
import { StaffLoginError, classifyStaffLoginFailure } from "./staff-login-failure";

describe("classifyStaffLoginFailure", () => {
  it("names each failure instead of a generic auth_failed", () => {
    expect(classifyStaffLoginFailure(new StaffLoginError("invalid_id_token", "x"))).toBe(
      "invalid_id_token",
    );
    expect(classifyStaffLoginFailure(new IdentityUnavailableError("down"))).toBe(
      "identity_unavailable",
    );
    expect(
      classifyStaffLoginFailure(new IdentityRejectedError(400, "rejected", "invalid_grant")),
    ).toBe("token_exchange_failed");
    expect(classifyStaffLoginFailure(new Error("redis down"))).toBe("session_unavailable");
  });
});

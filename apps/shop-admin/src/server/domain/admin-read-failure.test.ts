import { IdentityRejectedError, IdentityUnavailableError } from "@auction/identity-rp";
import { describe, expect, it } from "vitest";
import { classifyAdminReadFailure } from "./admin-read-failure";
import { StaffSessionEndedError } from "./staff-session-ended";

describe("classifyAdminReadFailure", () => {
  it("sends staff back to sign-in when the stored session is gone", () => {
    expect(classifyAdminReadFailure(new Error("Unauthorized"))).toEqual({ kind: "unauthorized" });
  });

  it("sends staff back to sign-in when Auth rejects the refresh or token exchange", () => {
    const rejected = new IdentityRejectedError(400, "refresh rejected", "invalid_grant");
    expect(classifyAdminReadFailure(rejected)).toEqual({ kind: "unauthorized" });
  });

  it("sends staff back to sign-in when the session could not be renewed", () => {
    expect(classifyAdminReadFailure(new StaffSessionEndedError("id_token_not_renewed"))).toEqual({
      kind: "unauthorized",
    });
  });

  it("treats Auth being unreachable as a failure and keeps the reason for the log", () => {
    expect(classifyAdminReadFailure(new IdentityUnavailableError("timeout"))).toEqual({
      kind: "failed",
      log: { name: "IdentityUnavailableError", message: "timeout" },
    });
  });

  it("keeps unexpected errors as failures", () => {
    expect(classifyAdminReadFailure(new Error("Invalid id_token after refresh"))).toEqual({
      kind: "failed",
      log: { name: "Error", message: "Invalid id_token after refresh" },
    });
    expect(classifyAdminReadFailure("boom")).toEqual({
      kind: "failed",
      log: { name: "UnknownError", message: "boom" },
    });
  });
});

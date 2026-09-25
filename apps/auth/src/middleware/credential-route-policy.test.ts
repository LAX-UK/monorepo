import { AUTH_ROUTE_PATH } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { isPrimaryLoginCredentialPath } from "./credential-route-policy.js";

describe("isPrimaryLoginCredentialPath", () => {
  it("treats sign-in and sign-up as primary login paths", () => {
    expect(isPrimaryLoginCredentialPath(`${AUTH_ROUTE_PATH}/sign-in/email`)).toBe(true);
    expect(isPrimaryLoginCredentialPath(`${AUTH_ROUTE_PATH}/sign-up/email`)).toBe(true);
  });

  it("excludes account-management 2FA and phone routes from same-origin-only CORS", () => {
    expect(isPrimaryLoginCredentialPath(`${AUTH_ROUTE_PATH}/two-factor/verify`)).toBe(false);
    expect(isPrimaryLoginCredentialPath(`${AUTH_ROUTE_PATH}/phone-number/send-otp`)).toBe(false);
    expect(isPrimaryLoginCredentialPath(`${AUTH_ROUTE_PATH}/phone-number/verify`)).toBe(false);
  });

  it("includes phone sign-in for hosted login", () => {
    expect(isPrimaryLoginCredentialPath(`${AUTH_ROUTE_PATH}/phone-number/sign-in`)).toBe(true);
  });
});

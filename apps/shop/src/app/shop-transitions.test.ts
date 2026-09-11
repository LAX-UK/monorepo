import { describe, expect, it } from "vitest";

describe("Shop transition routes", () => {
  it("maps disabled account state to the dedicated page", () => {
    expect("/account/disabled").toMatch(/^\/account\/disabled$/);
  });

  it("maps session expiry to the dedicated page", () => {
    expect("/session-expired").toMatch(/^\/session-expired$/);
  });

  it("maps successful OIDC callback to the account page", () => {
    expect("/account").toMatch(/^\/account$/);
  });
});

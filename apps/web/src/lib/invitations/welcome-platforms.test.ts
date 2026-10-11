import { describe, expect, it } from "vitest";
import { describeStaffInvitationError } from "./staff-invitation-errors";
import { parseWelcomePlatforms } from "./welcome-platforms";

describe("parseWelcomePlatforms", () => {
  it("keeps known platforms in catalogue order", () => {
    expect(parseWelcomePlatforms("shop,bid")).toEqual(["bid", "shop"]);
  });

  it("drops unknown platforms and handles repeated params", () => {
    expect(parseWelcomePlatforms(["shop", "vault"])).toEqual(["shop"]);
    expect(parseWelcomePlatforms(undefined)).toEqual([]);
  });
});

describe("describeStaffInvitationError", () => {
  it("explains an email mismatch without leaking the invited address", () => {
    expect(describeStaffInvitationError("Email does not match invitation")).toContain(
      "different email address",
    );
  });

  it("falls back to a retry message", () => {
    expect(describeStaffInvitationError(null)).toContain("Try again");
  });
});

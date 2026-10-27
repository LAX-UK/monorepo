import { describe, expect, it } from "vitest";
import { buildOrganisationsLink } from "./account-links";

describe("buildOrganisationsLink", () => {
  it("opens Bid's organisations page", () => {
    expect(buildOrganisationsLink({ bidPublicUrl: "https://lax.bid" })).toBe(
      "https://lax.bid/organisations",
    );
  });

  it("is null when Bid is not configured, so no card links nowhere", () => {
    expect(buildOrganisationsLink({})).toBeNull();
  });
});

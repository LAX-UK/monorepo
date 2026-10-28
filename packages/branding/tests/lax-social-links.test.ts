import { describe, expect, it } from "vitest";
import { hasSocialProfiles, socialProfilesFor } from "../src/lax-social-links.js";

describe("socialProfilesFor", () => {
  it("gives LAX Bid London Auction Xchange's profiles, named after that company", () => {
    expect(socialProfilesFor("bid")).toEqual([
      {
        network: "youtube",
        href: "https://www.youtube.com/@londonauctionxchange",
        label: "London Auction Xchange on YouTube",
      },
      {
        network: "instagram",
        href: "https://www.instagram.com/lax.bid",
        label: "London Auction Xchange on Instagram",
      },
      {
        network: "linkedin",
        href: "https://www.linkedin.com/company/london-auction-xchange/",
        label: "London Auction Xchange on LinkedIn",
      },
    ]);
  });

  it("never links lax.art or LAX Shop to the auction company's profiles", () => {
    expect(socialProfilesFor("art")).toEqual([]);
    expect(socialProfilesFor("shop")).toEqual([]);
    expect(hasSocialProfiles("art")).toBe(false);
    expect(hasSocialProfiles("bid")).toBe(true);
  });
});

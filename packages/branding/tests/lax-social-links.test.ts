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

  it("gives lax.art and LAX Shop London Art Exchange's profiles, never the auction company's", () => {
    const londonArtExchange = [
      {
        network: "youtube",
        href: "https://www.youtube.com/@LondonArtExchange",
        label: "London Art Exchange on YouTube",
      },
      {
        network: "instagram",
        href: "https://www.instagram.com/thelondonartexchange/",
        label: "London Art Exchange on Instagram",
      },
      {
        network: "tiktok",
        href: "https://www.tiktok.com/@londonartexchange",
        label: "London Art Exchange on TikTok",
      },
    ];
    expect(socialProfilesFor("art")).toEqual(londonArtExchange);
    expect(socialProfilesFor("shop")).toEqual(londonArtExchange);
    expect(hasSocialProfiles("art")).toBe(true);
    expect(hasSocialProfiles("bid")).toBe(true);
  });
});

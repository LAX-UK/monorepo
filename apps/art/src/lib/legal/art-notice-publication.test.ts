import { ART_CONSENT_COOKIE } from "@/lib/analytics/art-consent";
import {
  ART_IDENTITY_ID_TOKEN_COOKIE,
  ART_IDENTITY_SESSION_COOKIE,
} from "@/lib/art-identity.server";
import { ART_THEME_COOKIE } from "@/lib/theme/art-theme";
import { ART_EXCHANGE_NOTICES, legalPolicyTexts } from "@auction/marketing-ui";
import { describe, expect, it } from "vitest";
import {
  artNoticeVisibility,
  isArtNoticeSlug,
  isArtProductionDeployment,
  linkableArtNotices,
} from "./art-notice-publication";

const draft = { status: "draft", version: "0.1", lastUpdated: "2026-10-25" } as const;
const approved = { status: "approved", version: "1.0", lastUpdated: "2026-11-01" } as const;

describe("lax.art privacy and cookie notices", () => {
  it("treats the launch host or a prod image as production", () => {
    expect(
      isArtProductionDeployment({ storefrontHost: "www.thelax.art", deployEnv: undefined }),
    ).toBe(true);
    expect(
      isArtProductionDeployment({ storefrontHost: "test.thelax.art", deployEnv: "prod" }),
    ).toBe(true);
    expect(
      isArtProductionDeployment({ storefrontHost: "test.thelax.art", deployEnv: "test" }),
    ).toBe(false);
  });

  it("hides drafts on production and previews them elsewhere", () => {
    const releases = { privacy: draft, cookies: approved };
    expect(artNoticeVisibility("privacy", true, releases)).toBe("hidden");
    expect(artNoticeVisibility("privacy", false, releases)).toBe("draft-preview");
    expect(artNoticeVisibility("cookies", true, releases)).toBe("published");
    expect(linkableArtNotices(true, releases)).toEqual(["cookies"]);
    expect(linkableArtNotices(false, releases)).toEqual(["privacy", "cookies"]);
  });

  it("routes only the two notices away from the CMS", () => {
    expect(isArtNoticeSlug("privacy")).toBe(true);
    expect(isArtNoticeSlug("cookies")).toBe(true);
    expect(isArtNoticeSlug("terms")).toBe(false);
  });

  it("lists every cookie lax.art sets in the cookie policy", () => {
    const policy = legalPolicyTexts(ART_EXCHANGE_NOTICES.cookies).join("\n");
    for (const name of [
      ART_IDENTITY_SESSION_COOKIE,
      ART_IDENTITY_ID_TOKEN_COOKIE,
      ART_CONSENT_COOKIE,
      ART_THEME_COOKIE,
      "_ga",
    ]) {
      expect(policy, name).toContain(name);
    }
  });
});

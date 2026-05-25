import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(appRoot, rel), "utf8");
}

const ADAPTIVE_FRAME = /AdaptiveMediaFrame|HeroAdaptiveShell/;

const MARKETING_IMAGE_SURFACES = [
  {
    label: "sale detail hero",
    path: "components/sections/saleroom/saleroom-hero-adaptive.tsx",
  },
  {
    label: "home hero lot",
    path: "components/sections/home/lax-hero-lot.tsx",
  },
  {
    label: "home hero rotator slide",
    path: "components/sections/home/lax-hero-rotator.tsx",
  },
  {
    label: "archive lot hero card",
    path: "components/sections/archive/archive-lot-card-hero.tsx",
  },
  {
    label: "sale card media",
    path: "components/sections/sales/card/sale-card-media.tsx",
  },
  {
    label: "saleroom lot card",
    path: "components/sections/saleroom/saleroom-lot-card.tsx",
  },
] as const;

const LEGACY_OVERLAY_SHELL = /bg-black\/35 text-white/;

describe("marketing overlay tone contract", () => {
  it.each(MARKETING_IMAGE_SURFACES)(
    "$label uses adaptive media frame for image-aware overlays",
    ({ path }) => {
      expect(read(path)).toMatch(ADAPTIVE_FRAME);
    },
  );

  it("lot quick look overlay trigger uses overlay tone classes instead of fixed dark shell", () => {
    const src = read("components/marketing/lot-quick-look/lot-quick-look-trigger.tsx");
    expect(src).toContain("overlayIconButtonClasses");
    expect(src).not.toMatch(LEGACY_OVERLAY_SHELL);
  });

  it("watchlist heart adapts when inside an overlay frame", () => {
    const src = read("components/marketing/watchlist-heart-button.tsx");
    expect(src).toContain("useOverlayToneContext");
    expect(src).toContain("overlayIconButtonClasses");
  });

  it("saleroom hero uses tone-aware scrim and overlay text", () => {
    const src = read("components/sections/saleroom/saleroom-hero-adaptive.tsx");
    expect(src).toContain("HeroHorizontalScrim");
    expect(src).toContain("OverlayToneText");
    expect(src).not.toContain("text-white");
  });
});

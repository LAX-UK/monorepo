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
    expect(src).toContain('surface = "auto"');
    expect(src).toContain("resolveOverlayChrome");
  });

  it("marketing lot overlay actions use onImage surface for heart and quick look", () => {
    const src = read("components/marketing/lot-quick-look/marketing-lot-overlay-actions.tsx");
    expect(src).toContain('surface="onImage"');
  });

  it("home editors pick tile uses adaptive media with shared icon pill tone policy", () => {
    const tile = read("components/marketing/marketing-lot-tile.tsx");
    const card = read(
      "components/sections/home/editors-picks-marketing/editors-pick-marketing-card.tsx",
    );
    const picker = read("lib/media/pick-overlay-tone.ts");
    expect(tile).toMatch(ADAPTIVE_FRAME);
    expect(card).toContain("HOME_LOT_TILE_SLOTS");
    expect(card).toContain("adaptiveMedia");
    expect(picker).toContain('slotType === "pill"');
  });

  it("artist follow heart uses overlay tone icon shell", () => {
    const src = read("components/marketing/artist-watch-heart.tsx");
    expect(src).toContain("overlayIconButtonClasses");
    expect(src).toContain("useOverlayTone");
    expect(src).toContain("resolveOverlayChrome");
  });

  it("artist directory portrait uses adaptive media for follow heart tone", () => {
    const card = read("components/sections/artists/artist-directory-card.tsx");
    const frame = read("components/marketing/artist-portrait-frame.tsx");
    expect(card).toContain("ArtistPortraitFrame");
    expect(frame).toContain("ARTIST_PORTRAIT_SLOTS");
    expect(frame).toMatch(ADAPTIVE_FRAME);
  });

  it("urgency list row mobile heart uses onImage surface with adaptive frame", () => {
    const src = read("components/sections/home/urgency-lot-row.tsx");
    expect(src).toMatch(ADAPTIVE_FRAME);
    expect(src).toContain('surface="onImage"');
    expect(src).toContain("HOME_LOT_TILE_SLOTS");
  });

  it("lot detail rail uses adaptive media and onImage quick look", () => {
    const src = read("components/sections/artwork/redesign/lot-more-from-rail.tsx");
    expect(src).toMatch(ADAPTIVE_FRAME);
    expect(src).toContain('surface="onImage"');
    expect(src).toContain("LOT_CARD_GRID_SLOTS");
  });

  it("catalog editorial calm heart uses onImage surface inside adaptive frame", () => {
    const src = read("components/marketing/catalog-lot-views.tsx");
    expect(src).toContain('surface="onImage"');
    expect(src).toContain("EDITORIAL_CALM_SLOTS");
  });

  it("saleroom hero uses editorial surface layout without overlay scrim", () => {
    const src = read("components/sections/saleroom/hero/saleroom-hero-editorial.tsx");
    expect(src).toContain("SaleroomHeroCoverMedia");
    expect(src).toContain("DisplayHeading");
    expect(src).not.toContain("HeroHorizontalScrim");
    expect(src).not.toContain("OverlayToneText");
  });
});

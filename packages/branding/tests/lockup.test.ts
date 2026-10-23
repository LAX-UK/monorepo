import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_COLORS } from "../src/brand-identity.js";
import { BID_MARK_INK_PATHS } from "../src/lockup/bid-lockup-parts.js";
import { LAX_MARK_INK_PATHS } from "../src/lockup/lax-mark-paths.js";
import { LOCKUP_COPIES } from "../src/lockup/lockup-copies.js";
import {
  LAX_LOCKUP_DESCRIPTORS,
  LAX_LOCKUP_KINDS,
  type LaxLockupKind,
  laxLockup,
  laxLockupAutoSvg,
  laxLockupColors,
  laxLockupFileName,
  laxLockupSvg,
} from "../src/lockup/lockup.js";

const PUBLISHED = join(import.meta.dirname, "../public/lockups");
const REPO_ROOT = join(import.meta.dirname, "../../..");
const SCHEMES = ["light", "dark"] as const;
const PRODUCTS = ["bid", "shop", "art", "account"] as const;

describe("laxLockup", () => {
  it("keeps Bid's canvas and descriptor, tagline included", () => {
    const bid = laxLockup("bid");
    expect(bid.viewBox).toBe("0 0 1108.21 287.96");
    expect(bid.descriptor).toBe("BID");
    // Dot + B + I + D, outlined in Bid's own face.
    expect(bid.descriptorPaths).toHaveLength(4);
    expect(bid.ink.length).toBeGreaterThan(laxLockup("account").ink.length);
  });

  it("offers a compact Bid lockup: the gavel mark and .BID without the tagline, framed like the others", () => {
    const full = laxLockup("bid");
    const compact = laxLockup("bid-compact");
    expect(compact.descriptor).toBe("BID");
    expect(compact.descriptorPaths).toEqual(full.descriptorPaths);
    expect(compact.ink.length).toBe(BID_MARK_INK_PATHS.length);
    expect(compact.ink.length).toBeLessThan(full.ink.length);
    const shop = laxLockup("shop");
    // Same top and bottom as Shop, so the marks render at one height at one CSS height.
    const [, y, , height] = compact.viewBox.split(" ").map(Number);
    const [, shopY, , shopHeight] = shop.viewBox.split(" ").map(Number);
    expect(y).toBe(shopY);
    expect(height).toBeCloseTo(shopHeight ?? Number.NaN, 2);
    expect(compact.width).toBeLessThan(full.width);
  });

  it("keeps the compact Bid descriptor colours of the full Bid lockup", () => {
    for (const scheme of SCHEMES) {
      expect(laxLockupColors("bid-compact", scheme)).toEqual(laxLockupColors("bid", scheme));
    }
    expect(laxLockupFileName("bid-compact", "dark")).toBe("lax-bid-compact-dark.svg");
  });

  it("sets every other descriptor after the same dot, on Bid's baseline and left edge", () => {
    const bidDot = laxLockup("bid").descriptorPaths[0];
    for (const product of ["shop", "art", "account"] as const) {
      const { descriptorPaths, descriptor } = laxLockup(product);
      expect(descriptor).toBe(LAX_LOCKUP_DESCRIPTORS[product]);
      // Same dot outline, moved with the plain mark's X.
      expect(descriptorPaths[0]?.d).toBe(bidDot?.d);
      expect(descriptorPaths[0]?.transform).toBe("translate(-18 0)");
      expect(descriptorPaths).toHaveLength(1 + LAX_LOCKUP_DESCRIPTORS[product].length);
      for (const glyph of descriptorPaths.slice(1)) {
        expect(glyph.transform).toMatch(/^translate\([\d.]+ 287\.42\) scale\(0\.0659\)$/);
      }
    }
  });

  it("ends each tight frame at the descriptor and shares the mark's top and the baseline bottom", () => {
    for (const product of ["shop", "art", "account"] as const) {
      const { viewBox, width } = laxLockup(product);
      const [x = Number.NaN, y = Number.NaN, , height = Number.NaN] = viewBox
        .split(" ")
        .map(Number);
      expect(x).toBe(0);
      expect(y).toBe(6.9);
      expect(y + height).toBeCloseTo(287.96, 2);
      // Wider than the mark plus the dot, so the word is inside the frame.
      expect(width).toBeGreaterThan(700);
    }
    const width = (kind: LaxLockupKind) => laxLockup(kind).width;
    expect(width("account")).toBeGreaterThan(width("shop"));
    expect(width("shop")).toBeGreaterThan(width("art"));
  });

  it("frames the bare mark tightly with no descriptor", () => {
    const mark = laxLockup("mark");
    expect(mark.descriptor).toBeNull();
    expect(mark.descriptorPaths).toEqual([]);
    expect(mark.viewBox).toBe("0 6.9 586.3 280.9");
  });
});

describe("gavel mark", () => {
  const gavelPaths = BID_MARK_INK_PATHS.slice(2);

  it("is Bid's alone, in the full and compact lockups: every other lockup uses the plain mark", () => {
    const withGavel = LAX_LOCKUP_KINDS.filter((kind) =>
      laxLockup(kind).ink.some((path) => gavelPaths.includes(path.d)),
    );
    expect(withGavel).toEqual(["bid", "bid-compact"]);
  });

  it("draws the plain mark as the L, a two-stroke A and the X", () => {
    for (const kind of ["mark", "shop", "art", "account"] as const) {
      expect(laxLockup(kind).ink.map((path) => path.d)).toEqual([...LAX_MARK_INK_PATHS]);
    }
    expect(LAX_MARK_INK_PATHS).toHaveLength(3);
  });

  it("keeps the gavel out of every published non-Bid file", () => {
    for (const kind of ["mark", "exchange", "shop", "art", "account"] as const) {
      for (const scheme of [...SCHEMES, "auto"] as const) {
        const file = readFileSync(join(PUBLISHED, laxLockupFileName(kind, scheme)), "utf8");
        for (const d of gavelPaths) expect(file).not.toContain(d);
      }
    }
  });
});

describe("exchange lockup", () => {
  it("is the plain mark followed by the three tagline lines, all in ink", () => {
    const exchange = laxLockup("exchange");
    expect(exchange.label).toBe("LAX London Art Exchange");
    expect(exchange.descriptor).toBeNull();
    expect(exchange.descriptorPaths).toEqual([]);
    expect(exchange.ink.slice(0, 3).map((path) => path.d)).toEqual([...LAX_MARK_INK_PATHS]);
    // London, Art Exchange(R), Marylebone.
    expect(exchange.ink).toHaveLength(LAX_MARK_INK_PATHS.length + 3);
    expect(exchange.mist).toHaveLength(1);
  });

  it("keeps the slash one fixed mist grey in both schemes and the tagline neutral", () => {
    for (const scheme of SCHEMES) {
      const colors = laxLockupColors("exchange", scheme);
      expect(colors.mist).toBe("#b9bac0");
      expect(colors.descriptor).toBe(colors.ink);
    }
  });
});

describe("laxLockupColors", () => {
  it("marks Account with teal, matching the surface it sits on", () => {
    expect(laxLockupColors("account", "light").descriptor).toBe("#0f766e");
    expect(laxLockupColors("account", "dark").descriptor).toBe("#2dd4bf");
  });

  it("keeps Bid's descriptor exactly as the Bid lockup master draws it", () => {
    expect(laxLockupColors("bid", "light").descriptor).toBe("#202759");
    expect(laxLockupColors("bid", "dark").descriptor).toBe("#b9bac0");
  });

  it("gives Shop and Art the neutral ink until their accents are chosen", () => {
    for (const product of ["shop", "art"] as const) {
      for (const scheme of SCHEMES) {
        const colors = laxLockupColors(product, scheme);
        expect(colors.descriptor).toBe(colors.ink);
      }
    }
  });
});

describe("published lockup files", () => {
  it("match what the lockup definition generates (run pnpm --filter @auction/branding generate:lockups)", () => {
    for (const kind of LAX_LOCKUP_KINDS) {
      for (const scheme of SCHEMES) {
        const file = readFileSync(join(PUBLISHED, laxLockupFileName(kind, scheme)), "utf8");
        expect(file, laxLockupFileName(kind, scheme)).toBe(laxLockupSvg(kind, scheme));
      }
    }
  });

  it("keeps every copy served by an app or hosted sign-in identical to the published file", () => {
    for (const { path, kind, variant } of LOCKUP_COPIES) {
      const copy = readFileSync(join(REPO_ROOT, path), "utf8");
      const source = readFileSync(join(PUBLISHED, laxLockupFileName(kind, variant)), "utf8");
      expect(copy, path).toBe(source);
    }
  });

  it("publish an auto file per lockup that switches colour with the operating system", () => {
    for (const kind of LAX_LOCKUP_KINDS) {
      const file = readFileSync(join(PUBLISHED, laxLockupFileName(kind, "auto")), "utf8");
      expect(file, kind).toBe(laxLockupAutoSvg(kind));
      expect(file).toContain("@media(prefers-color-scheme:dark)");
      // Colours live in the stylesheet, so the file can recolour as one.
      expect(file).not.toMatch(/ fill="/);
    }
  });

  it("never carry Bid's navy outside Bid, or Account's teal anywhere but Account", () => {
    for (const scheme of SCHEMES) {
      for (const product of PRODUCTS) {
        const svg = laxLockupSvg(product, scheme);
        if (product !== "bid") {
          expect(svg).not.toMatch(new RegExp(`${BRAND_COLORS.midnight}|#202759`, "i"));
        }
        if (product !== "account") expect(svg).not.toMatch(/#0f766e|#2dd4bf/i);
      }
      expect(laxLockupSvg("mark", scheme)).not.toMatch(/#0f766e|#2dd4bf|#202759/i);
    }
  });

  it("are pure vector with an accessible name and no font dependency", () => {
    for (const kind of LAX_LOCKUP_KINDS) {
      const svg = laxLockupSvg(kind, "light");
      expect(svg).toContain(`<title>${laxLockup(kind).label}</title>`);
      expect(svg).not.toMatch(/<text|<image|font-family/);
    }
  });
});

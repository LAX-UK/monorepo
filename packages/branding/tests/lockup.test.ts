import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_COLORS } from "../src/brand-identity.js";
import { BID_MARK_INK_PATHS } from "../src/lockup/bid-lockup-parts.js";
import { LAX_MARK_INK_PATHS } from "../src/lockup/lax-mark-paths.js";
import {
  LAX_LOCKUP_DESCRIPTORS,
  LAX_LOCKUP_KINDS,
  type LaxLockupKind,
  laxLockup,
  laxLockupColors,
  laxLockupFileName,
  laxLockupSvg,
} from "../src/lockup/lockup.js";

const PUBLISHED = join(import.meta.dirname, "../public/lockups");
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

  it("is Bid's alone: every other lockup uses the plain mark", () => {
    const withGavel = LAX_LOCKUP_KINDS.filter((kind) =>
      laxLockup(kind).ink.some((path) => gavelPaths.includes(path.d)),
    );
    expect(withGavel).toEqual(["bid"]);
  });

  it("draws the plain mark as the L, a two-stroke A and the X", () => {
    for (const kind of ["mark", "shop", "art", "account"] as const) {
      expect(laxLockup(kind).ink.map((path) => path.d)).toEqual([...LAX_MARK_INK_PATHS]);
    }
    expect(LAX_MARK_INK_PATHS).toHaveLength(3);
  });

  it("keeps the gavel out of every published non-Bid file", () => {
    for (const kind of ["mark", "shop", "art", "account"] as const) {
      for (const scheme of SCHEMES) {
        const file = readFileSync(join(PUBLISHED, laxLockupFileName(kind, scheme)), "utf8");
        for (const d of gavelPaths) expect(file).not.toContain(d);
      }
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

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const FILES = sourceFiles(SRC).map((file) => ({
  file: path.relative(SRC, file),
  text: readFileSync(file, "utf8"),
}));

function filesMatching(pattern: RegExp): string[] {
  return FILES.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
}

describe("lax.art bottom clearance", () => {
  it("reserves --lax-bottom-bar-space once, in the root layout", () => {
    expect(filesMatching(/<MarketingBottomBarSpace\b/)).toEqual(["app/layout.tsx"]);
    // Nothing else reads the variable to pad itself; the shared classes do that.
    expect(filesMatching(/var\(--lax-bottom-bar-space/)).toEqual([]);
  });

  it("keeps the footer free of tab-bar padding", () => {
    const footer = FILES.find(({ file }) => file === "components/layout/art-footer.tsx");
    expect(footer?.text).not.toMatch(/bottom-nav|bottom-bar|pb-\[/);
  });

  it("raises the cookie dock with the shared class", () => {
    const consent = FILES.find(
      ({ file }) => file === "components/analytics/art-analytics-consent.client.tsx",
    );
    expect(consent?.text).toContain("BOTTOM_BAR_ABOVE_CLASS");
  });

  it("has dropped the floating pill and its reservations", () => {
    expect(filesMatching(/art-bottom-nav|ArtMobileBottomNav|MarketingFloatingTabBar/)).toEqual([]);
    expect(filesMatching(/98px|4\.125rem/)).toEqual([]);
  });
});

describe("lax.art footer surface", () => {
  const css = FILES.find(({ file }) => file === "app/base.css")?.text ?? "";

  const darkAt = css.indexOf("html.dark {");

  it("uses the shared footer surface in the light theme", () => {
    const light = css.slice(0, darkAt);
    expect(light).toMatch(/--color-footer-bg:\s*#ededef;/);
    expect(css).not.toContain("#f8f8f8");
  });

  it("uses the shared footer surface in the dark theme", () => {
    const dark = css.slice(darkAt);
    expect(dark).toMatch(/--color-footer-bg:\s*#1b1d1d;/);
    expect(css).not.toContain("#0d0f0f");
  });
});

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { type Browser, type Page, chromium } from "@playwright/test";

/**
 * Chromium harness for the overlay motion tests. It loads the real stylesheets (the LAX tokens,
 * the staff token scope from packages/staff-ui, the kit's motion.css and Sonner's own CSS) into a
 * blank page, builds the markup a Radix portal would, and reads what the browser resolves: the
 * animation name, its duration and the keyframes it plays. Nothing is matched against the CSS
 * text, so a changed rule changes the result.
 */
const cwd = process.cwd();
const require = createRequire(import.meta.url);

export const LAX_SYSTEM_CSS = readFileSync(
  resolve(cwd, "../branding/public/lax-system.css"),
  "utf8",
);
export const MOTION_SOURCE = readFileSync(resolve(cwd, "src/lax/motion.css"), "utf8");
export const SONNER_CSS = readFileSync(
  resolve(dirname(require.resolve("sonner")), "styles.css"),
  "utf8",
);

/** The staff token block exactly as the staff theme writes it, selector list included. */
export function staffTokenBlock(): string {
  const theme = readFileSync(resolve(cwd, "../staff-ui/src/theme.css"), "utf8");
  const block = /[^{}]*\{[^{}]*--lax-motion-press:\s*0ms[^{}]*\}/.exec(theme);
  if (!block) throw new Error("staff motion token block not found in staff-ui theme.css");
  return block[0];
}

export type ReducedMotionEmulation = "no-preference" | "reduce";

/**
 * Chromium for the suite. CI sets `LAX_REQUIRE_CHROMIUM=1`, where a missing browser is a failure;
 * elsewhere a machine without one skips these tests (`null`) and the rest of the suite runs.
 */
export async function launch(): Promise<Browser | null> {
  try {
    return await chromium.launch();
  } catch (error) {
    // Cloud sandboxes ship Chromium outside Playwright's own cache.
    const fallback = "/opt/pw-browsers/chromium";
    if (existsSync(fallback)) return chromium.launch({ executablePath: fallback });
    if (process.env.LAX_REQUIRE_CHROMIUM === "1") throw error;
    return null;
  }
}

export async function pageWith(
  browser: Browser,
  options: {
    css: string;
    body: string;
    htmlAttributes?: string;
    reducedMotion?: ReducedMotionEmulation;
    width?: number;
  },
): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: options.width ?? 1280, height: 800 } });
  await page.emulateMedia({ reducedMotion: options.reducedMotion ?? "no-preference" });
  await page.setContent(
    `<!doctype html><html ${options.htmlAttributes ?? ""}><head><style>${options.css}</style></head><body>${options.body}</body></html>`,
  );
  return page;
}

export type ResolvedAnimation = {
  name: string;
  /** Milliseconds. */
  duration: number;
  /** True when any keyframe sets a transform. */
  moves: boolean;
  /** Every property the keyframes set, other than offset, easing and composite. */
  properties: string[];
};

/** What the browser plays on `[data-probe="id"]`: name, duration and the keyframes' properties. */
export async function resolveAnimation(page: Page, id: string): Promise<ResolvedAnimation> {
  return page.evaluate((probe) => {
    const el = document.querySelector(`[data-probe="${probe}"]`) as HTMLElement;
    const style = getComputedStyle(el);
    const name = style.animationName;
    const duration = Number.parseFloat(style.animationDuration) * 1000;
    const properties = new Set<string>();
    for (const sheet of Array.from(document.styleSheets)) {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSKeyframesRule && rule.name === name) {
          for (const frame of Array.from(rule.cssRules)) {
            const declared = (frame as CSSKeyframeRule).style;
            for (let i = 0; i < declared.length; i++) properties.add(declared[i] as string);
          }
        }
      }
    }
    return {
      name,
      duration: name === "none" ? 0 : duration,
      moves: properties.has("transform"),
      properties: [...properties].sort(),
    };
  }, id);
}

import { readFileSync } from "node:fs";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";
import ts from "typescript";

/**
 * The view transition CSS (`packages/marketing-ui/src/marketing-header.css`) checked in Chromium on
 * its own, with the real LAX motion tokens: no app or server is needed. The helpers never start a
 * transition under reduced motion, so the CSS backstop is only reachable here, where the test
 * starts one directly and reads what the browser animates. The theme toggle cases run the shared
 * `revealThemeFromToggle` that LAX Bid, LAX Shop and lax.art all call, against each app's own
 * motion aliases.
 *
 * Run: `pnpm --filter @auction/web exec playwright test e2e/view-transition-css.spec.ts`
 * (also part of `test:e2e:motion`).
 */

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8");

/** Every product that imports `marketing-header.css` and switches theme with the shared wipe. */
const APP_STYLES = {
  "LAX Bid": "apps/web/src/app/globals.css",
  "LAX Shop": "apps/shop/src/app/base.css",
  "lax.art": "apps/art/src/app/base.css",
} as const;
type App = keyof typeof APP_STYLES;

/** The two app-level motion aliases the theme wipe reads, copied from the app's own stylesheet. */
function appMotionAliases(app: App): string {
  const styles = read(APP_STYLES[app]);
  const lines = ["--motion-duration-xl", "--motion-ease-emphasize"].map((name) => {
    const match = styles.match(new RegExp(`${name}:\\s*([^;]+);`));
    if (!match) throw new Error(`${name} is not defined in ${APP_STYLES[app]}`);
    return `${name}: ${match[1]};`;
  });
  return `:root { ${lines.join(" ")} }`;
}

const cssFor = (app: App) =>
  [
    read("packages/branding/public/lax-system.css"),
    appMotionAliases(app),
    read("packages/marketing-ui/src/marketing-header.css"),
  ].join("\n");
const css = cssFor("LAX Bid");

/** The shared theme switch every product's toggle calls, as plain browser JS. */
function themeHelperScript(): string {
  const source = read("packages/marketing-ui/src/motion/theme-view-transition.ts");
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return `${js.replace(/^export /gm, "")}\nwindow.revealThemeFromToggle = revealThemeFromToggle;`;
}

type Outcome = {
  animations: { pseudo: string; name: string; duration: number }[];
  elapsedMs: number;
};

/** `undefined` is the unmarked public page change (the lot morph); the others mark their kind. */
type Kind = "theme" | "admin" | undefined;

async function runTransition(
  page: Page,
  kind: Kind,
  reduceMotion?: "force-reduce" | "force-allow",
): Promise<Outcome> {
  await page.setContent(
    `<!doctype html><html><head><style>${css}</style></head><body><main>Page</main></body></html>`,
  );
  return page.evaluate(
    async ({ kind, reduceMotion }) => {
      const root = document.documentElement;
      if (reduceMotion) root.dataset.reduceMotion = reduceMotion;
      // Marked inside the update, as the app does.
      const transition = document.startViewTransition(() => {
        if (kind) root.dataset.viewTransition = kind;
        if (kind === "theme") {
          root.style.setProperty("--theme-toggle-at", "40px 30px");
          root.style.setProperty("--theme-toggle-radius", "1000px");
        }
        root.classList.toggle("dark");
      });
      await transition.ready;
      // From the first transition frame to the end: the animation phase the CSS controls (the
      // snapshot before it depends on machine load, not on the CSS).
      const readyAt = performance.now();
      const animations = document
        .getAnimations()
        .map((a) => ({
          pseudo: (a.effect as KeyframeEffect | null)?.pseudoElement ?? "",
          name: (a as CSSAnimation).animationName ?? "",
          duration: Number(a.effect?.getTiming().duration ?? 0),
        }))
        .filter((a) => a.pseudo.startsWith("::view-transition"));
      await transition.finished;
      return { animations, elapsedMs: performance.now() - readyAt };
    },
    { kind: kind ?? null, reduceMotion },
  );
}

type ToggleOutcome = Outcome & {
  /** `data-view-transition` and `--theme-toggle-at` while the transition runs, and after it. */
  during: { kind: string | null; at: string };
  after: { kind: string | null; style: string };
  /** The wipe's first clip-path keyframe, which carries the origin. */
  from: string;
};

/** Presses a toggle wired to the shared helper, as the Bid, Shop and lax.art toggles are. */
async function pressThemeToggle(page: Page, app: App): Promise<ToggleOutcome> {
  await page.setContent(
    `<!doctype html><html><head><style>${cssFor(app)}</style></head><body>
      <button id="toggle" style="position:fixed;left:20px;top:10px;width:40px;height:40px">Theme</button>
      <main>Page</main></body></html>`,
  );
  await page.addScriptTag({ content: themeHelperScript() });
  return page.evaluate(async () => {
    const root = document.documentElement;
    const start = document.startViewTransition.bind(document);
    let transition: ViewTransition | undefined;
    document.startViewTransition = ((update: () => void) => {
      transition = start(update);
      return transition;
    }) as typeof document.startViewTransition;
    const button = document.getElementById("toggle") as HTMLButtonElement;
    const reveal = (
      window as unknown as {
        revealThemeFromToggle: (button: Element | null, apply: () => void) => void;
      }
    ).revealThemeFromToggle;
    button.addEventListener("click", () => reveal(button, () => root.classList.toggle("dark")));
    button.click();
    if (!transition) throw new Error("the toggle started no view transition");
    await transition.ready;
    const readyAt = performance.now();
    const during = {
      kind: root.getAttribute("data-view-transition"),
      at: root.style.getPropertyValue("--theme-toggle-at"),
    };
    const running = document
      .getAnimations()
      .filter((a) =>
        ((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith("::view-transition"),
      );
    const wipe = running.find((a) => (a as CSSAnimation).animationName === "theme-reveal");
    const from = String(
      (wipe?.effect as KeyframeEffect | undefined)?.getKeyframes()[0]?.clipPath ?? "",
    );
    const animations = running.map((a) => ({
      pseudo: (a.effect as KeyframeEffect | null)?.pseudoElement ?? "",
      name: (a as CSSAnimation).animationName ?? "",
      duration: Number(a.effect?.getTiming().duration ?? 0),
    }));
    await transition.finished;
    const elapsedMs = performance.now() - readyAt;
    // Cleanup runs in the `finished` reaction; let it settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      animations,
      elapsedMs,
      during,
      from,
      after: { kind: root.getAttribute("data-view-transition"), style: root.style.cssText },
    };
  });
}

test.describe("view transition CSS in the browser @optin", () => {
  test("the theme wipe plays at rest (the harness sees real animations)", async ({ page }) => {
    const outcome = await runTransition(page, "theme");
    expect(outcome.animations.map((a) => a.name)).toContain("theme-reveal");
    expect(outcome.elapsedMs).toBeGreaterThan(500);
  });

  test("an unmarked page change runs the morph timing and never the wipe", async ({ page }) => {
    const outcome = await runTransition(page, undefined);
    expect(outcome.animations.length).toBeGreaterThan(0);
    expect(outcome.animations.map((a) => a.name)).not.toContain("theme-reveal");
    // `--lax-motion-morph`
    expect(outcome.animations.every((a) => a.duration === 360)).toBe(true);
  });

  for (const kind of ["theme", undefined, "admin"] as const) {
    test(`OS reduced motion cancels the ${kind ?? "page change"} transition`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const outcome = await runTransition(page, kind);
      expect(outcome.animations).toEqual([]);
      expect(outcome.elapsedMs).toBeLessThan(100);
    });

    test(`the in-app reduce switch cancels the ${kind ?? "page change"} transition`, async ({
      page,
    }) => {
      const outcome = await runTransition(page, kind, "force-reduce");
      expect(outcome.animations).toEqual([]);
      expect(outcome.elapsedMs).toBeLessThan(100);
    });
  }

  test("the in-app allow switch keeps the theme wipe under OS reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const outcome = await runTransition(page, "theme", "force-allow");
    expect(outcome.animations.map((a) => a.name)).toContain("theme-reveal");
  });

  test("an admin navigation runs the page cross-fade timing and never the wipe", async ({
    page,
  }) => {
    const outcome = await runTransition(page, "admin");
    expect(outcome.animations.map((a) => a.name)).not.toContain("theme-reveal");
    const root = (pseudo: string) =>
      outcome.animations.find((a) => a.pseudo === pseudo && a.name !== "")?.duration;
    // `--lax-motion-page-out` / `--lax-motion-page-in` (public values; staff scope lowers them).
    expect(root("::view-transition-old(root)")).toBe(140);
    expect(root("::view-transition-new(root)")).toBe(200);
  });

  for (const app of Object.keys(APP_STYLES) as App[]) {
    test(`the ${app} theme toggle plays the circle wipe from the button`, async ({ page }) => {
      const outcome = await pressThemeToggle(page, app);
      const wipe = outcome.animations.find((a) => a.name === "theme-reveal");
      expect(wipe?.pseudo).toBe("::view-transition-new(root)");
      // `--motion-duration-xl`, the app's alias.
      expect(wipe?.duration).toBe(900);
      expect(outcome.elapsedMs).toBeGreaterThan(500);
      // Grown from the button's centre (20 + 40 / 2, 10 + 40 / 2), not the `100% 0` fallback.
      expect(outcome.during).toEqual({ kind: "theme", at: "40px 30px" });
      expect(outcome.from).toContain("at 40px 30px");
      expect(outcome.after).toEqual({ kind: null, style: "" });
    });

    test(`the ${app} theme toggle switches at once under reduced motion`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setContent(`<!doctype html><html><head><style>${cssFor(app)}</style></head>
        <body><button id="toggle">Theme</button></body></html>`);
      await page.addScriptTag({ content: themeHelperScript() });
      const result = await page.evaluate(() => {
        const root = document.documentElement;
        let started = false;
        const start = document.startViewTransition.bind(document);
        document.startViewTransition = ((update: () => void) => {
          started = true;
          return start(update);
        }) as typeof document.startViewTransition;
        const reveal = (
          window as unknown as {
            revealThemeFromToggle: (button: Element | null, apply: () => void) => void;
          }
        ).revealThemeFromToggle;
        reveal(document.getElementById("toggle"), () => root.classList.toggle("dark"));
        return { started, dark: root.classList.contains("dark") };
      });
      expect(result).toEqual({ started: false, dark: true });
    });
  }
});

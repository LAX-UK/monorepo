import { readFileSync } from "node:fs";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

/**
 * The view transition CSS (`packages/marketing-ui/src/marketing-header.css`) checked in Chromium on
 * its own, with the real LAX motion tokens: no app or server is needed. The helpers never start a
 * transition under reduced motion, so the CSS backstop is only reachable here, where the test
 * starts one directly and reads what the browser animates.
 *
 * Run: `pnpm --filter @auction/web exec playwright test e2e/view-transition-css.spec.ts`
 * (also part of `test:e2e:motion`).
 */

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8");

/** The two app-level motion aliases the theme wipe reads, copied from apps/web globals.css. */
function appMotionAliases(): string {
  const globals = read("apps/web/src/app/globals.css");
  const lines = ["--motion-duration-xl", "--motion-ease-emphasize"].map((name) => {
    const match = globals.match(new RegExp(`${name}:\\s*([^;]+);`));
    if (!match) throw new Error(`${name} is not defined in globals.css`);
    return `${name}: ${match[1]};`;
  });
  return `:root { ${lines.join(" ")} }`;
}

const css = [
  read("packages/branding/public/lax-system.css"),
  appMotionAliases(),
  read("packages/marketing-ui/src/marketing-header.css"),
].join("\n");

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
});

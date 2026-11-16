import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Shop's first-screen images appear at once (docs/design/motion.md, "Images" and MO15): no Shop
 * stylesheet hides or fades an image, so a priority or eager picture paints as soon as it decodes.
 * Only a below-the-fold image (`loading="lazy"`) fades, and that fade is the kit's
 * (`.lax-image-fade`, packages/ui/src/lax/image-fade.css), not Shop's.
 */
const dir = import.meta.dirname;
const sheets = readdirSync(dir)
  .filter((name) => name.endsWith(".css"))
  .map((name) => ({
    name,
    css: readFileSync(path.join(dir, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""),
  }));

/** Every innermost `selector { body }` rule. */
function rules(css: string): { selector: string; body: string }[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: (m[1] as string).trim(),
    body: m[2] as string,
  }));
}

describe("Shop images on the first screen", () => {
  it("reads Shop's stylesheets", () => {
    expect(sheets.map((s) => s.name)).toContain("state.css");
  });

  it("no Shop rule fades or hides an image", () => {
    for (const { name, css } of sheets) {
      for (const { selector, body } of rules(css)) {
        if (!/(^|[\s>+~,(])img\b/.test(selector)) continue;
        expect(body, `${name}: ${selector}`).not.toMatch(
          /(^|[\s;])(animation(-name)?|transition(-property)?)\s*:[^;]*\b(opacity|[\w-]*fade[\w-]*|all)\b/,
        );
        expect(body, `${name}: ${selector}`).not.toMatch(
          /(^|[\s;])(animation(-name)?)\s*:\s*(?!none\b)[\w-]+/,
        );
        expect(body, `${name}: ${selector}`).not.toMatch(/(^|[\s;])opacity\s*:\s*0(\.0+)?\s*(;|$)/);
      }
    }
  });
});

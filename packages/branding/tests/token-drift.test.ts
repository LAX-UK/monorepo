import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WEB_SRC = join(__dirname, "../../../apps/web/src");

/** Legacy palette / fonts that must not reappear in component source. */
const BANNED_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "legacy gold primary", re: /#775a19/i },
  { label: "legacy near-black", re: /#050505/i },
  { label: "legacy cool paper", re: /#f1f1f3/i },
  { label: "DM Sans hardcode", re: /DM_Sans|font-dm-sans/i },
  { label: "Poppins hardcode", re: /font-poppins|Poppins-Bold|Poppins-Medium/i },
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("apps/web token drift guardrail", () => {
  const files = collectSourceFiles(WEB_SRC);

  for (const { label, re } of BANNED_PATTERNS) {
    it(`blocks ${label} in apps/web/src`, () => {
      const hits: string[] = [];
      for (const file of files) {
        const rel = file.replace(`${WEB_SRC}/`, "");
        if (rel === "app/globals.css") continue;
        const content = readFileSync(file, "utf8");
        if (re.test(content)) hits.push(rel);
      }
      expect(hits, `Found banned ${label} in:\n${hits.join("\n")}`).toEqual([]);
    });
  }
});

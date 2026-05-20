import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_SRC = join(import.meta.dirname, "..", "..");
const ENGINE_DIR = join(WEB_SRC, "components/gallery/engine");
const RESTRICTED = ["embla-carousel-react", "yet-another-react-lightbox"];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "engine" && path.includes("gallery")) continue;
      walk(path, acc);
    } else if (
      /\.(ts|tsx)$/.test(name) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx")
    ) {
      acc.push(path);
    }
  }
  return acc;
}

describe("gallery import boundary (DIP)", () => {
  it("does not import Embla or yarl outside components/gallery/engine", () => {
    const componentsRoot = join(WEB_SRC, "components");
    const offenders: string[] = [];

    for (const file of walk(componentsRoot)) {
      if (file.startsWith(ENGINE_DIR)) continue;
      const text = readFileSync(file, "utf8");
      for (const mod of RESTRICTED) {
        if (text.includes(`from "${mod}"`) || text.includes(`from '${mod}'`)) {
          offenders.push(`${file} imports ${mod}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

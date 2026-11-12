import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) found.push(path);
  }
  return found;
}

/** Re-offer send/accept services: apps only. The domain package holds pure rules, not endpoints. */
function reofferServices(): string[] {
  const apps = join(repoRoot, "apps");
  return readdirSync(apps)
    .map((app) => join(apps, app, "src"))
    .filter((dir) => {
      try {
        return statSync(dir).isDirectory();
      } catch {
        return false;
      }
    })
    .flatMap(sourceFiles)
    .filter((file) => /reoffer/i.test(relative(repoRoot, file)))
    .filter((file) => /(send|accept)/i.test(file.split("/").pop() ?? ""));
}

describe("re-offer services and the money pause", () => {
  it("every re-offer send/accept service calls assertMoneyNotPaused (tracked: none exists yet)", () => {
    const missing = reofferServices().filter((file) => {
      const name = file.split("/").pop() ?? "";
      const text = readFileSync(file, "utf8");
      const needed = [
        ...(/send/i.test(name) ? ["reoffer_send"] : []),
        ...(/accept/i.test(name) ? ["reoffer_accept"] : []),
      ];
      return (
        !text.includes("assertMoneyNotPaused") || needed.some((action) => !text.includes(action))
      );
    });
    expect(missing.map((file) => relative(repoRoot, file))).toEqual([]);
  });
});

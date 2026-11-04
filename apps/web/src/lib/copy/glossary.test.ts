import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPLY_WINDOW } from "./glossary";

const SRC = path.resolve(__dirname, "../..");

/** Staff screens and legal documents keep their own wording. */
const EXCLUDED_DIRS = [
  "app/admin",
  "app/api",
  "app/dev",
  "app/(marketing)/privacy",
  "app/(marketing)/terms",
  "app/(marketing)/cookies",
  "app/(marketing)/legal",
  "components/admin",
  "lib/actions/admin",
  "lib/actions/admin-dashboard-widgets.ts",
  "lib/actions/stripe-connect.actions.ts",
  "lib/data/view-models/legal-entity-overview.vm.ts",
  "lib/admin",
  "components/staff",
  "lib/staff",
  "test",
];

/** Words the family retired; the plain term is in `glossary.ts`. */
const RETIRED_TERMS: readonly RegExp[] = [
  /Stripe Connect/i,
  /consignment wizard/i,
  /NFT-backed/i,
  /dashboard/i,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    const rel = path.relative(SRC, full).split(path.sep).join("/");
    if (EXCLUDED_DIRS.some((excluded) => rel === excluded || rel.startsWith(`${excluded}/`))) {
      return [];
    }
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(name) || /\.(test|stories|d)\.tsx?$/.test(name)) return [];
    return [full];
  });
}

/** Text a person can read: quoted strings with a space in them, and JSX text between tags. */
function readableText(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const withoutImports = code.replace(/^\s*(import|export)\b[^;]*?from\s+["'][^"']+["'];?/gm, "");
  const quoted = [...withoutImports.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map(
    (m) => m[2],
  );
  const jsx = [...withoutImports.matchAll(/>([^<>{}=;]+)</g)].map((m) => m[1]);
  return [...quoted, ...jsx]
    .filter((text): text is string => text !== undefined)
    .filter((text) => /\s/.test(text.trim()) && !text.startsWith("/") && !text.startsWith("@/"));
}

/** A literal inside page metadata (titles, descriptions for search) is not on-screen copy. */
function isMetadataLine(source: string, text: string): boolean {
  const at = source.indexOf(text);
  const before = source.slice(Math.max(0, at - 160), at);
  return /metadataFor\w+\(|export const metadata\b|generateMetadata/.test(before);
}

describe("client-facing words", () => {
  it("keeps the reply promise to one working day", () => {
    expect(REPLY_WINDOW).toBe("within one working day");
  });

  it("uses no retired term in text a client reads", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const text of readableText(source)) {
        if (!RETIRED_TERMS.some((term) => term.test(text))) continue;
        if (isMetadataLine(source, text)) continue;
        hits.push(`${path.relative(SRC, file)}: ${text.trim().slice(0, 90)}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** Headers whose value a client can forge unless the resolver checks who sent them. */
const FORWARDING_HEADER = /x-forwarded-for|x-real-ip|cf-connecting-ip|do-connecting-ip/i;

/**
 * Files allowed to name a forwarding header, each with the reason it is not the shared resolver.
 * Anything new belongs behind `@auction/http-headers/client-ip` instead.
 */
const ALLOWED: Record<string, string> = {
  "packages/http-headers/src/client-ip.ts": "the resolver itself",
  "packages/auth/src/client-ip-headers.ts":
    "header names for the identity issuer, which must stay free of other workspace packages",
  "packages/auth/src/phone-number-plugin.ts":
    "Better Auth plugin inside the identity issuer; it has no TCP peer to check",
  "packages/auth/src/sign-in-turnstile-gate.ts":
    "Better Auth hook inside the identity issuer; it has no TCP peer to check",
  "apps/api/src/infrastructure/http-identity-issuer.client.ts":
    "passes the caller's headers on to the identity issuer, which resolves them itself",
  "apps/auth/src/container/mount-auth-operational-routes.ts":
    "logs the raw headers for diagnostics; the value is never used to decide anything",
  "apps/shop-identity/src/commerce-client-ip.ts": "Shop identity's own peer-checked resolver",
  "packages/shop-portal/src/bff/create-commerce-bff-client.ts":
    "Shop BFF hands the browser's headers to Shop identity, which resolves them",
};

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    if (name === "node_modules" || name === "dist" || name === ".next") continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, found);
    } else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.(test|spec)\.(ts|tsx|mjs)$/.test(name)) {
      found.push(path);
    }
  }
  return found;
}

function workspaceSources(): string[] {
  return ["apps", "packages"].flatMap((group) =>
    readdirSync(join(repoRoot, group)).flatMap((name) => {
      const src = join(repoRoot, group, name, "src");
      return statSync(join(repoRoot, group, name)).isDirectory() && safeIsDirectory(src)
        ? sourceFiles(src)
        : [];
    }),
  );
}

function safeIsDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

describe("client address drift", () => {
  it("reads forwarding headers only in the shared resolver and the listed exceptions", () => {
    const offenders = workspaceSources()
      .map((file) => relative(repoRoot, file))
      .filter((file) => !(file in ALLOWED))
      .filter((file) => FORWARDING_HEADER.test(readFileSync(join(repoRoot, file), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("keeps every exception real, so the list cannot go stale", () => {
    for (const file of Object.keys(ALLOWED)) {
      expect(FORWARDING_HEADER.test(readFileSync(join(repoRoot, file), "utf8")), file).toBe(true);
    }
  });
});

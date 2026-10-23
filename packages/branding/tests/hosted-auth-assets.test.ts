import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The issuer's hosted pages (`packages/auth`) may not import this package, so they carry
 * copies of the lockups and fonts. These tests keep the copies from drifting.
 */
const hostedAssets = new URL("../../auth/src/hosted-auth/assets/", import.meta.url);

function bytes(url: URL): Buffer {
  return readFileSync(fileURLToPath(url));
}

function filesIn(url: URL): string[] {
  return readdirSync(fileURLToPath(url)).sort();
}

describe("hosted auth lockups", () => {
  const source = new URL("../public/lockups/", import.meta.url);
  const copies = new URL("lockups/", hostedAssets);

  it("serves only the Account lockup, in light and dark", () => {
    expect(filesIn(copies)).toEqual(["lax-account-dark.svg", "lax-account.svg"]);
  });

  it.each(filesIn(copies))("keeps %s byte-identical to packages/branding", (file) => {
    expect(bytes(new URL(file, copies)).equals(bytes(new URL(file, source)))).toBe(true);
  });
});

describe("hosted auth fonts", () => {
  const source = new URL("../fonts/", import.meta.url);
  const copies = new URL("fonts/", hostedAssets);

  it("carries every font file and licence from packages/branding", () => {
    expect(filesIn(copies)).toEqual(filesIn(source));
  });

  it.each(filesIn(copies))("keeps %s byte-identical to packages/branding", (file) => {
    expect(bytes(new URL(file, copies)).equals(bytes(new URL(file, source)))).toBe(true);
  });
});

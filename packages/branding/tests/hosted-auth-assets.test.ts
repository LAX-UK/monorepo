import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { legalOperatorSentence } from "../src/legal-entity.js";

/**
 * The issuer's hosted pages (`packages/auth`) may not import this package, so they carry
 * copies of the lockups, the sign-in painting, the fonts and the company line. These tests keep
 * the copies from drifting.
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

  it("serves the Account lockup and the three product marks, in light and dark", () => {
    expect(filesIn(copies)).toEqual([
      "lax-account-dark.svg",
      "lax-account.svg",
      "lax-art-dark.svg",
      "lax-art.svg",
      "lax-bid-compact-dark.svg",
      "lax-bid-compact.svg",
      "lax-shop-dark.svg",
      "lax-shop.svg",
    ]);
  });

  it.each(filesIn(copies))("keeps %s byte-identical to packages/branding", (file) => {
    expect(bytes(new URL(file, copies)).equals(bytes(new URL(file, source)))).toBe(true);
  });
});

describe("hosted auth images", () => {
  const source = new URL("../public/images/", import.meta.url);
  const copies = new URL("images/", hostedAssets);

  it("serves the sign-in painting LAX Account shows", () => {
    expect(filesIn(copies)).toEqual(["signin-gallery.webp"]);
  });

  it.each(filesIn(copies))("keeps %s byte-identical to packages/branding", (file) => {
    expect(bytes(new URL(file, copies)).equals(bytes(new URL(file, source)))).toBe(true);
  });
});

describe("hosted auth copy", () => {
  it("names the companies behind LAX Account as the legal-entity registry does", async () => {
    const { HOSTED_COPY } = await import("../../auth/src/hosted-auth/copy.js");
    expect(HOSTED_COPY.accountOperators).toBe(legalOperatorSentence("account"));
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

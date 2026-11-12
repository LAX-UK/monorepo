// @vitest-environment node
import { readFileSync } from "node:fs";
import { LEGAL_ENTITIES } from "@auction/branding";
import { describe, expect, it } from "vitest";

/**
 * The accounting domain is a pure package and cannot import branding, so `LEGAL_ENTITY_NAMES` in
 * its document model is a copy of the registered names. Every name on a provider document must be
 * the registered one, so the copy is read here and checked against the branding source of truth.
 */
const source = readFileSync(
  new URL("../../../../../packages/accounting-domain/src/document.ts", import.meta.url),
  "utf8",
);
const block = /LEGAL_ENTITY_NAMES[^=]*=\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
const copied = [...block.matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]);

describe("accounting-domain legal entity names", () => {
  it("carries exactly the registered names from @auction/branding", () => {
    const registered = Object.values(LEGAL_ENTITIES).map((e) => [
      e.id.replaceAll("-", "_"),
      e.name,
    ]);
    expect(copied.sort()).toEqual(registered.sort());
  });
});

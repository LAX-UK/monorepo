import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  findRetiredVendorMatches,
  isRetiredVendorScanSurface,
} from "./verify-identity-boundary.mjs";

const root = resolve(import.meta.dirname, "../..");

test("retired vendor guard scans integration surfaces only", () => {
  assert.equal(isRetiredVendorScanSurface("apps/shop/src/page.tsx"), true);
  assert.equal(isRetiredVendorScanSurface("packages/auth/src/foo.ts"), true);
  assert.equal(isRetiredVendorScanSurface("scripts/ci/verify-identity-boundary.mjs"), true);
  assert.equal(isRetiredVendorScanSurface(".github/workflows/ci.yml"), true);
  assert.equal(isRetiredVendorScanSurface("docs/runbooks/shop-mvp-spec.md"), false);
  assert.equal(isRetiredVendorScanSurface("docs/runbooks/identity-boundary-cutover.md"), false);
  assert.equal(isRetiredVendorScanSurface("docs/architecture/09-lax-identity-boundary.md"), false);
});

test("approved runbooks may document retired vendor migration without failing the guard", () => {
  const shopMvp = readFileSync(resolve(root, "docs/runbooks/shop-mvp-spec.md"), "utf8");
  const cutover = readFileSync(resolve(root, "docs/runbooks/identity-boundary-cutover.md"), "utf8");

  assert.equal(findRetiredVendorMatches([["docs/runbooks/shop-mvp-spec.md", shopMvp]]).length, 0);
  assert.equal(
    findRetiredVendorMatches([["docs/runbooks/identity-boundary-cutover.md", cutover]]).length,
    0,
  );
});

test("retired vendor references in integration surfaces still fail the guard", () => {
  const retiredVendor = ["shop", "ify"].join("");
  const matches = findRetiredVendorMatches([
    ["apps/shop/src/lib/vendor.ts", `legacy ${retiredVendor} checkout adapter`],
  ]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.label, "retired commerce vendor");
  assert.equal(matches[0]?.path, "apps/shop/src/lib/vendor.ts");
});

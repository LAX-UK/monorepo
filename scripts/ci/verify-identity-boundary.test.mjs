import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  GIT_LISTING_MAX_BUFFER,
  findRetiredVendorMatches,
  isRetiredVendorScanSurface,
} from "./verify-identity-boundary.mjs";

const root = resolve(import.meta.dirname, "../..");

test("the repository file listing fits the buffer the guard reads it into", () => {
  const listing = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8", maxBuffer: GIT_LISTING_MAX_BUFFER },
  );
  assert.equal(listing.error, undefined);
  assert.equal(listing.status, 0);
  // Keep at least 4x headroom so growth does not quietly bring back ENOBUFS.
  assert.ok(Buffer.byteLength(listing.stdout) * 4 < GIT_LISTING_MAX_BUFFER);
  assert.ok(GIT_LISTING_MAX_BUFFER > 1024 * 1024);
});

test("retired vendor guard scans integration surfaces only", () => {
  assert.equal(isRetiredVendorScanSurface("apps/shop/src/page.tsx"), true);
  assert.equal(isRetiredVendorScanSurface("packages/auth/src/foo.ts"), true);
  assert.equal(isRetiredVendorScanSurface("scripts/ci/verify-identity-boundary.mjs"), true);
  assert.equal(isRetiredVendorScanSurface(".github/workflows/ci.yml"), true);
  assert.equal(isRetiredVendorScanSurface("docs/runbooks/shop-mvp-spec.md"), false);
  assert.equal(
    isRetiredVendorScanSurface("docs/archive/runbooks/identity-boundary-cutover.md"),
    false,
  );
  assert.equal(isRetiredVendorScanSurface("docs/architecture/09-lax-identity-boundary.md"), false);
});

test("approved runbooks may document retired vendor migration without failing the guard", () => {
  const shopMvp = readFileSync(resolve(root, "docs/runbooks/shop-mvp-spec.md"), "utf8");
  const cutover = readFileSync(
    resolve(root, "docs/archive/runbooks/identity-boundary-cutover.md"),
    "utf8",
  );

  assert.equal(findRetiredVendorMatches([["docs/runbooks/shop-mvp-spec.md", shopMvp]]).length, 0);
  assert.equal(
    findRetiredVendorMatches([["docs/archive/runbooks/identity-boundary-cutover.md", cutover]])
      .length,
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

test("the retired shop domain fails as an address but not as the Shop's brand name", () => {
  const domain = ["lax", "shop"].join(".");
  const address = findRetiredVendorMatches([["apps/shop/src/a.ts", `https://${domain}/cart`]]);
  assert.equal(address.length, 1);
  assert.equal(address[0]?.label, "retired shop domain");
  assert.equal(findRetiredVendorMatches([["apps/shop/src/a.ts", `label: "${domain}"`]]).length, 0);
});

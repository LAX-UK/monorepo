import assert from "node:assert/strict";
import { test } from "node:test";
import {
  kitFile,
  kitFiles,
  moduleOwner,
  ownerTotals,
  realModulePath,
} from "./route-bundle-report-rule.mjs";

test("a concatenated module is attributed by its real path", () => {
  assert.equal(
    realModulePath("./a.ts + 5 modules (concatenated)/../packages/ui/src/button.tsx"),
    "../packages/ui/src/button.tsx",
  );
});

test("module owners: npm package, bundled framework, workspace package, app source", () => {
  assert.equal(moduleOwner("./../node_modules/buffer/index.js"), "buffer");
  assert.equal(
    moduleOwner("./../node_modules/.pnpm/@sentry+core@8/node_modules/@sentry/core/build/x.js"),
    "@sentry/core",
  );
  assert.equal(
    moduleOwner("./../node_modules/.pnpm/next@15/node_modules/next/dist/compiled/react-dom/x.js"),
    "next (bundled react-dom)",
  );
  assert.equal(
    moduleOwner("./../node_modules/.pnpm/next@15/node_modules/next/dist/client/x.js"),
    "next",
  );
  assert.equal(moduleOwner("./../packages/ui/src/components/ui/button.tsx"), "@auction/ui");
  assert.equal(moduleOwner("./src/components/x.tsx"), "app source");
});

const chunk = (parsedSize, gzipSize, leaves) => ({
  parsedSize,
  gzipSize,
  groups: leaves.map(([p, size]) => ({ path: p, parsedSize: size })),
});

test("owner totals scale module sizes to the chunk's gzip size, largest first", () => {
  const chunks = [
    chunk(2048, 1024, [
      ["./../node_modules/zod/a.js", 1024],
      ["./src/a.tsx", 1024],
    ]),
    chunk(1024, 1024, [["./../node_modules/zod/b.js", 1024]]),
  ];
  const [first, second] = ownerTotals(chunks);
  assert.equal(first.owner, "zod");
  assert.equal(first.gzipKb, 1.5);
  assert.equal(first.modules, 2);
  assert.equal(second.owner, "app source");
  assert.equal(second.gzipKb, 0.5);
});

test("kit files drop the src or dist prefix and ignore other code", () => {
  assert.equal(kitFile("./../packages/ui/dist/lax/tabs.js", "ui"), "lax/tabs.js");
  assert.equal(kitFile("./src/x.tsx", "ui"), null);
  const files = kitFiles(
    [
      chunk(1024, 512, [
        ["./../packages/ui/src/a.tsx", 1024],
        ["./src/x.tsx", 5],
      ]),
    ],
    "ui",
  );
  assert.deepEqual(files, [{ file: "a.tsx", gzipKb: 0.5 }]);
});

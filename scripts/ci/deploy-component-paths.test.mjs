import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEPLOY_COMPONENTS, componentsForChangedPaths } from "./deploy-component-paths.mjs";

describe("componentsForChangedPaths", () => {
  it("returns empty for docs-only changes", () => {
    assert.deepEqual(componentsForChangedPaths(["docs/readme.md"]), []);
  });

  it("expands to all components on lockfile change", () => {
    assert.deepEqual(componentsForChangedPaths(["pnpm-lock.yaml"]), DEPLOY_COMPONENTS);
  });

  it("selects api for apps/api changes", () => {
    const hits = componentsForChangedPaths(["apps/api/src/foo.ts"]);
    assert.ok(hits.includes("api"));
  });

  it("selects api, web, and worker for packages/types changes", () => {
    const hits = componentsForChangedPaths(["packages/types/src/index.ts"]);
    assert.ok(hits.includes("api"));
    assert.ok(hits.includes("web"));
    assert.ok(hits.includes("worker"));
  });
});

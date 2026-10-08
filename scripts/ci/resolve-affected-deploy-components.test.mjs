import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterAffectedForDeploy } from "./deploy-tag-map.mjs";
import { resolveBuildComponents } from "./resolve-affected-deploy-components.mjs";

describe("filterAffectedForDeploy", () => {
  it("removes auth when AUTH_TAG_MAP_ENABLED is off", () => {
    assert.deepEqual(filterAffectedForDeploy(["api", "auth"]), ["api"]);
  });
});

describe("resolveBuildComponents", () => {
  it("adds migrate when any image component changes", () => {
    assert.deepEqual(resolveBuildComponents(["api"]), ["api", "migrate"]);
  });

  it("builds migrate when migrate is the only affected component", () => {
    assert.deepEqual(resolveBuildComponents(["migrate"]), ["migrate"]);
  });
});

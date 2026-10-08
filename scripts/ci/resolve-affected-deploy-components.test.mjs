import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterAffectedForDeploy } from "./deploy-tag-map.mjs";
import {
  resolveBuildComponents,
  resolveBuildComponentsWhenTagsLag,
  rollbackRehearsalAffected,
} from "./resolve-affected-deploy-components.mjs";

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

describe("rollbackRehearsalAffected", () => {
  it("includes deploy components with a live SHA tag", () => {
    const live = {
      api: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      shop: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    };
    assert.deepEqual(rollbackRehearsalAffected(live), ["api", "shop"]);
  });
});

describe("resolveBuildComponentsWhenTagsLag", () => {
  const target = "cccccccccccccccccccccccccccccccccccccccc";
  const live = { api: target, ws: "dddddddddddddddddddddddddddddddddddddddd" };

  it("skips builds when every live tag already matches target", () => {
    assert.deepEqual(
      resolveBuildComponentsWhenTagsLag(["api", "ws"], { api: target, ws: target }, target),
      [],
    );
  });

  it("builds only components whose live tag differs from target", () => {
    assert.deepEqual(resolveBuildComponentsWhenTagsLag(["api", "ws"], live, target), [
      "migrate",
      "ws",
    ]);
  });
});

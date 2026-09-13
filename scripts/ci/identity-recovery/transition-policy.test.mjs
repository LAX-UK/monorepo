import assert from "node:assert/strict";
import test from "node:test";
import { assertTransition, restorationRequired } from "./transition-policy.mjs";

test("allows expected recovery transitions", () => {
  assert.doesNotThrow(() => assertTransition("acceptance_enabled", "rollback_rehearsal"));
  assert.doesNotThrow(() => assertTransition("rollback_rehearsal", "restore_candidate"));
});

test("rejects invalid transitions", () => {
  assert.throws(() => assertTransition("deploy_candidate", "rollback_rehearsal"));
});

test("detects when restoration is required", () => {
  assert.equal(restorationRequired(["acceptance_enabled", "rollback_rehearsal"]), true);
  assert.equal(restorationRequired(["acceptance_enabled"]), false);
});

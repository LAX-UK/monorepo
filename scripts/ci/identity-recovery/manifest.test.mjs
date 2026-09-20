import assert from "node:assert/strict";
import test from "node:test";
import { parseRecoveryManifest } from "./manifest.mjs";

const sha = "a".repeat(40);
const digest = `sha256:${"b".repeat(64)}`;
const manifest = {
  version: 1,
  repository: "LAX-UK/monorepo",
  monorepoSha: sha,
  infraSha: sha,
  migrationJournal: { tip: "0161_identity_cutover", sha256: "c".repeat(64) },
  dataContractVersion: "identity-v1",
  enableAuthSsfDelivery: true,
  identity: { sha, digest, buildRun: "1" },
  shopIdentity: { sha, digest, buildRun: "2" },
  shop: { sha, digest, buildRun: "3" },
  shopApi: { sha, digest, buildRun: "4" },
};

test("accepts a complete immutable recovery manifest", () => {
  assert.deepEqual(parseRecoveryManifest(JSON.stringify(manifest)), manifest);
});

test("rejects incomplete manifests", () => {
  assert.throws(() => parseRecoveryManifest(JSON.stringify({ ...manifest, version: 2 })));
  assert.throws(() => parseRecoveryManifest(JSON.stringify({ ...manifest, identity: { sha } })));
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseRecoveryManifest } from "./identity-recovery/manifest.mjs";

const sha = "a".repeat(40);
const digest = `sha256:${"b".repeat(64)}`;

test("write-recovery-accepted-release emits a parseable manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "recovery-release-"));
  const outputPath = join(dir, "accepted-release.json");
  const result = spawnSync(process.execPath, ["scripts/ci/write-recovery-accepted-release.mjs"], {
    cwd: join(import.meta.dirname, "../.."),
    env: {
      ...process.env,
      MONOREPO_SHA: sha,
      INFRA_SHA: sha,
      IDENTITY_SHA: sha,
      IDENTITY_DIGEST: digest,
      IDENTITY_BUILD_RUN: "100",
      SHOP_IDENTITY_SHA: sha,
      SHOP_IDENTITY_DIGEST: digest,
      SHOP_IDENTITY_BUILD_RUN: "101",
      SHOP_SHA: sha,
      SHOP_DIGEST: digest,
      SHOP_BUILD_RUN: "102",
      RECOVERY_ACCEPTED_RELEASE_PATH: outputPath,
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const manifest = parseRecoveryManifest(readFileSync(outputPath, "utf8"));
  assert.equal(manifest.repository, "LAX-UK/monorepo");
  assert.match(manifest.migrationJournal.sha256, /^[0-9a-f]{64}$/);
});

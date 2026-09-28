import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSoakArtifactName,
  resolveSoakWindow,
  soakArtifactNameForSample,
} from "./identity-soak-window.mjs";

const liveSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

test("parseSoakArtifactName recognizes sample, maintenance, and reset artifacts", () => {
  assert.deepEqual(parseSoakArtifactName(`${soakArtifactNameForSample(liveSha, "99")}`), {
    kind: "sample",
    sha: liveSha,
    runId: "99",
  });
  assert.deepEqual(parseSoakArtifactName("identity-staging-soak-maintenance-42"), {
    kind: "maintenance",
    runId: "42",
  });
  assert.deepEqual(parseSoakArtifactName(`identity-staging-soak-reset-${liveSha}-7`), {
    kind: "reset",
    sha: liveSha,
    runId: "7",
  });
});

test("resolveSoakWindow starts after maintenance and release changes", () => {
  const otherSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const window = resolveSoakWindow({
    liveSha,
    artifacts: [
      { name: soakArtifactNameForSample(otherSha, "1"), created_at: "2026-09-28T10:00:00Z" },
      { name: "identity-staging-soak-maintenance-2", created_at: "2026-09-28T11:00:00Z" },
      { name: soakArtifactNameForSample(liveSha, "3"), created_at: "2026-09-28T11:05:00Z" },
      { name: soakArtifactNameForSample(liveSha, "4"), created_at: "2026-09-28T11:20:00Z" },
    ],
  });
  assert.ok(window);
  assert.equal(window.identitySha, liveSha);
  assert.equal(window.startedMs, Date.parse("2026-09-28T11:05:00Z"));
});

test("resolveSoakWindow honors manual reset markers for the live release", () => {
  const window = resolveSoakWindow({
    liveSha,
    artifacts: [
      { name: `identity-staging-soak-reset-${liveSha}-9`, created_at: "2026-09-28T14:00:00Z" },
      { name: soakArtifactNameForSample(liveSha, "10"), created_at: "2026-09-28T14:05:00Z" },
    ],
  });
  assert.ok(window);
  assert.equal(window.startedMs, Date.parse("2026-09-28T14:05:00Z"));
});

test("resolveSoakWindow returns null before the first live sample", () => {
  const window = resolveSoakWindow({
    liveSha,
    artifacts: [
      { name: "identity-staging-soak-maintenance-1", created_at: "2026-09-28T12:00:00Z" },
    ],
  });
  assert.equal(window, null);
});

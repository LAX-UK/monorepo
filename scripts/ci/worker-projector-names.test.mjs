import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  ALL_STAGING_PROJECTOR_NAMES,
  DOMAIN_EVENT_PROJECTOR_NAMES,
  IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR,
} from "./worker-projector-names.mjs";

const root = resolve(import.meta.dirname, "../..");
const projectorDir = resolve(root, "apps/worker/src/projectors");

function collectWorkerProjectorNames() {
  const names = new Set();
  for (const file of readdirSync(projectorDir)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const text = readFileSync(resolve(projectorDir, file), "utf8");
    for (const match of text.matchAll(
      /(?:export const [A-Z_]+PROJECTOR|const PROJECTOR_NAME)\s*=\s*"([a-z_]+)"/g,
    )) {
      names.add(match[1]);
    }
  }
  const relay = readFileSync(
    resolve(root, "apps/worker/src/repositories/drizzle-identity-outbox-relay.repository.ts"),
    "utf8",
  );
  const relayMatch = relay.match(/IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR\s*=\s*"([a-z_]+)"/);
  if (relayMatch) names.add(relayMatch[1]);
  return [...names].sort();
}

test("worker projector SSOT matches worker source constants", () => {
  const fromWorker = collectWorkerProjectorNames();
  assert.deepEqual(
    [...DOMAIN_EVENT_PROJECTOR_NAMES].sort(),
    fromWorker.filter((n) => n !== IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR).sort(),
  );
  assert.equal(ALL_STAGING_PROJECTOR_NAMES.length, 20);
  assert.ok(ALL_STAGING_PROJECTOR_NAMES.includes(IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR));
});

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function writeRecoveryEvidence(outputPath, payload) {
  mkdirSync(dirname(outputPath), { recursive: true });
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  writeFileSync(outputPath, body, { mode: 0o600 });
  const digest = createHash("sha256").update(body).digest("hex");
  return { path: outputPath, digest: `sha256:${digest}` };
}

export function acceptancePhaseEvidence(phase, details) {
  return {
    phase,
    observedAt: new Date().toISOString(),
    ...details,
  };
}

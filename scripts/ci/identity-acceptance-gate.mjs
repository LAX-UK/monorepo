#!/usr/bin/env node
/**
 * Summarizes probe step outcomes for identity-staging-acceptance (continue-on-error).
 * Set PROBE_OUTCOMES as newline-separated "id=outcome" pairs.
 */
import { appendFileSync } from "node:fs";

const raw = process.env.PROBE_OUTCOMES?.trim();
if (!raw) {
  console.error("PROBE_OUTCOMES is required");
  process.exit(2);
}

/** @type {{ id: string, outcome: string }[]} */
const probes = [];
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  const separator = trimmed.indexOf("=");
  if (separator === -1) continue;
  probes.push({
    id: trimmed.slice(0, separator).trim(),
    outcome: trimmed.slice(separator + 1).trim(),
  });
}

const failures = probes.filter(({ outcome }) => outcome === "failure");
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

if (summaryPath) {
  const lines = [
    "## Identity acceptance probes",
    "",
    "| Probe | Outcome |",
    "| --- | --- |",
    ...probes.map(({ id, outcome }) => `| \`${id}\` | ${outcome} |`),
  ];
  if (failures.length > 0) {
    lines.push("", `**${failures.length} probe(s) failed.**`);
  }
  appendFileSync(summaryPath, `${lines.join("\n")}\n`);
}

if (failures.length > 0) {
  for (const { id } of failures) {
    console.error(`::error::Acceptance probe failed: ${id}`);
  }
  process.exit(1);
}

console.log("All acceptance probes succeeded or were skipped.");

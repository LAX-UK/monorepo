#!/usr/bin/env node
/**
 * Parse `<40-char-git-sha>@<manifest-digest>` pins used for immutable staging deploys.
 */
export function parseDockerImagePin(value, label = "image") {
  const trimmed = String(value ?? "").trim();
  const match = /^([0-9a-f]{40})@(.+)$/.exec(trimmed);
  if (!match) {
    throw new Error(`${label} must be <40-char-sha>@<digest>, got ${trimmed || "(empty)"}`);
  }
  return { sha: match[1], digest: match[2] };
}

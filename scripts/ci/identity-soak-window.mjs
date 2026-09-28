/** Shared 24h identity staging soak window constants and pure checks. */

export const SOAK_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SOAK_MAX_GAP_MS = 25 * 60 * 1000;
export const SOAK_TARGET_SAMPLES = 96;
/** Sleep before chaining the next sample (~13m + run time ≈ 15m cadence). */
export const SOAK_CHAIN_SLEEP_SEC = 780;

export function soakWindowEndMs(startedMs) {
  return startedMs + SOAK_WINDOW_MS;
}

export function isWithinSoakWindow(timestampMs, startedMs) {
  const endMs = soakWindowEndMs(startedMs);
  return timestampMs >= startedMs && timestampMs <= endMs;
}

export function filterWithinSoakWindow(items, getTimeMs, startedMs) {
  return items.filter((item) => isWithinSoakWindow(getTimeMs(item), startedMs));
}

export function isSoakWindowComplete(nowMs, startedMs) {
  return nowMs >= soakWindowEndMs(startedMs);
}

/**
 * @param {number[]} sortedTimesAsc
 * @param {number} maxGapMs
 * @returns {{ ok: true } | { ok: false; gapMs: number; betweenIndex: number }}
 */
export function checkSequentialGaps(sortedTimesAsc, maxGapMs) {
  for (let index = 1; index < sortedTimesAsc.length; index += 1) {
    const gapMs = sortedTimesAsc[index] - sortedTimesAsc[index - 1];
    if (gapMs > maxGapMs) {
      return { ok: false, gapMs, betweenIndex: index };
    }
  }
  return { ok: true };
}

/**
 * @param {number} firstSampleMs
 * @param {number} startedMs
 * @param {number} maxGapMs
 */
export function checkStartGap(firstSampleMs, startedMs, maxGapMs) {
  const gapMs = firstSampleMs - startedMs;
  if (gapMs > maxGapMs) {
    return { ok: false, gapMs };
  }
  return { ok: true };
}

export const SOAK_SAMPLE_PREFIX = "identity-staging-soak-sample-";
export const SOAK_MAINTENANCE_PREFIX = "identity-staging-soak-maintenance-";
export const SOAK_RESET_PREFIX = "identity-staging-soak-reset-";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

/**
 * @param {string} name
 * @returns {{ kind: "sample"; sha: string; runId: string } | { kind: "maintenance"; runId: string } | { kind: "reset"; sha: string; runId: string } | null}
 */
export function parseSoakArtifactName(name) {
  const maintenanceMatch = name.match(/^identity-staging-soak-maintenance-(\d+)$/);
  if (maintenanceMatch) {
    return { kind: "maintenance", runId: maintenanceMatch[1] };
  }
  const resetMatch = name.match(/^identity-staging-soak-reset-([0-9a-f]{40})-(\d+)$/);
  if (resetMatch) {
    return { kind: "reset", sha: resetMatch[1], runId: resetMatch[2] };
  }
  const sampleMatch = name.match(/^identity-staging-soak-sample-([0-9a-f]{40})-(\d+)$/);
  if (sampleMatch) {
    return { kind: "sample", sha: sampleMatch[1], runId: sampleMatch[2] };
  }
  return null;
}

/**
 * Resolve the active soak window start for the live Identity SHA using artifact metadata.
 *
 * @param {{ liveSha: string; artifacts: Array<{ name: string; created_at: string }> }} params
 * @returns {{ startedMs: number; identitySha: string } | null}
 */
export function resolveSoakWindow({ liveSha, artifacts }) {
  if (!SHA_PATTERN.test(liveSha)) {
    throw new Error(`liveSha must be a 40-character git SHA (got "${liveSha}")`);
  }

  const sorted = [...artifacts]
    .filter((artifact) => parseSoakArtifactName(artifact.name))
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));

  let boundaryMs = 0;
  let lastSampleSha = null;

  for (const artifact of sorted) {
    const parsed = parseSoakArtifactName(artifact.name);
    if (!parsed) continue;
    const createdMs = Date.parse(artifact.created_at);
    if (!Number.isFinite(createdMs)) continue;

    if (parsed.kind === "maintenance") {
      boundaryMs = Math.max(boundaryMs, createdMs);
      continue;
    }
    if (parsed.kind === "reset" && parsed.sha === liveSha) {
      boundaryMs = Math.max(boundaryMs, createdMs);
      continue;
    }
    if (parsed.kind === "sample") {
      if (parsed.sha === liveSha && lastSampleSha !== null && lastSampleSha !== liveSha) {
        boundaryMs = Math.max(boundaryMs, createdMs);
      }
      lastSampleSha = parsed.sha;
    }
  }

  const liveSamples = sorted
    .map((artifact) => ({ artifact, parsed: parseSoakArtifactName(artifact.name) }))
    .filter((entry) => entry.parsed?.kind === "sample" && entry.parsed.sha === liveSha)
    .map((entry) => Date.parse(entry.artifact.created_at))
    .filter((value) => Number.isFinite(value) && value >= boundaryMs);

  if (liveSamples.length === 0) {
    return null;
  }

  return {
    identitySha: liveSha,
    startedMs: Math.min(...liveSamples),
  };
}

export function soakArtifactNameForSample(identitySha, runId) {
  return `${SOAK_SAMPLE_PREFIX}${identitySha}-${runId}`;
}

export function soakArtifactNameForMaintenance(runId) {
  return `${SOAK_MAINTENANCE_PREFIX}${runId}`;
}

export function soakArtifactNameForReset(identitySha, runId) {
  return `${SOAK_RESET_PREFIX}${identitySha}-${runId}`;
}

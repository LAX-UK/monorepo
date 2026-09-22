const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;

function requireString(value, field, pattern) {
  if (typeof value !== "string" || (pattern && !pattern.test(value))) {
    throw new Error(`Invalid recovery manifest field: ${field}`);
  }
  return value;
}

export function parseRecoveryManifest(serialized) {
  let manifest;
  try {
    manifest = JSON.parse(serialized);
  } catch {
    throw new Error("Recovery manifest must be valid JSON");
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Recovery manifest must be an object");
  }
  if (manifest.version !== 1 || typeof manifest.enableAuthSsfDelivery !== "boolean") {
    throw new Error("Recovery manifest has an unsupported version or SSF state");
  }
  requireString(manifest.repository, "repository");
  requireString(manifest.monorepoSha, "monorepoSha", SHA);
  requireString(manifest.infraSha, "infraSha", SHA);
  requireString(manifest.migrationJournal?.tip, "migrationJournal.tip");
  requireString(manifest.migrationJournal?.sha256, "migrationJournal.sha256", /^[0-9a-f]{64}$/);
  requireString(manifest.dataContractVersion, "dataContractVersion");
  for (const component of ["identity", "shopIdentity", "shop", "shopApi"]) {
    const value = manifest[component];
    requireString(value?.sha, `${component}.sha`, SHA);
    requireString(value?.digest, `${component}.digest`, DIGEST);
    requireString(value?.buildRun, `${component}.buildRun`, /^[0-9]+$/);
  }
  return manifest;
}

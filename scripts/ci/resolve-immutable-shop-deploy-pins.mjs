#!/usr/bin/env node
/**
 * Resolve Terraform image pins for automatic Shop deploy on test:
 * Shop boundary images from the release manifest at the merge SHA; Identity from live auth.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { digestForTag, listTags } from "./registry-tag-poll.mjs";

const environment = process.env.ENVIRONMENT ?? "test";
const manifestPath = process.env.RELEASE_MANIFEST;
const monorepoSha = process.env.MONOREPO_SHA;
const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");

function componentEntry(manifest, component) {
  const repository = `lax-${environment}-${component}`;
  const entry = manifest.components?.find((item) => item.repository === repository);
  if (!entry) {
    throw new Error(`Release manifest missing ${repository}`);
  }
  if (entry.commitSha !== monorepoSha) {
    throw new Error(`${repository} manifest SHA ${entry.commitSha} != merge SHA ${monorepoSha}`);
  }
  return entry;
}

async function resolveLiveIdentitySha() {
  const response = await fetch(`${authBase}/health/ready`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`health/ready failed (${response.status})`);
  }
  const body = await response.json();
  const release = String(body.release ?? body.version ?? "").trim();
  if (!/^[0-9a-f]{40}$/.test(release)) {
    throw new Error(`Invalid Identity release SHA: ${release || "(missing)"}`);
  }
  return release;
}

function digestForRepository(repository, sha) {
  const tags = listTags(repository);
  const digest = digestForTag(tags, sha);
  if (!digest) {
    throw new Error(`Missing immutable tag ${sha} for ${repository}`);
  }
  return digest;
}

async function main() {
  if (!manifestPath) throw new Error("Set RELEASE_MANIFEST");
  if (!/^[0-9a-f]{40}$/.test(monorepoSha ?? "")) {
    throw new Error("Set MONOREPO_SHA to the merge commit");
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const shopIdentity = componentEntry(manifest, "shop-identity");
  const shop = componentEntry(manifest, "shop");
  const shopApi = componentEntry(manifest, "shop-api");

  const identitySha = await resolveLiveIdentitySha();
  const identityDigest = digestForRepository(`lax-${environment}-identity`, identitySha);

  const pins = {
    identity_sha: identitySha,
    identity_digest: identityDigest,
    shop_identity_sha: shopIdentity.commitSha,
    shop_identity_digest: shopIdentity.digest,
    shop_sha: shop.commitSha,
    shop_digest: shop.digest,
    shop_api_sha: shopApi.commitSha,
    shop_api_digest: shopApi.digest,
  };

  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    for (const [key, value] of Object.entries(pins)) {
      appendFileSync(outputPath, `${key}=${value}\n`);
    }
  }
  process.stdout.write(`${JSON.stringify(pins, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

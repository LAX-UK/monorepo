#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { verifyImmutableContract, waitForTagDigest } from "./registry-tag-poll.mjs";

const registry = (process.env.DOCR_REGISTRY ?? "registry.digitalocean.com/lax-bid").replace(
  /\/+$/,
  "",
);

const contracts = [
  {
    repository: "lax-test-identity",
    sha: process.env.IDENTITY_SHA,
    digest: process.env.IDENTITY_DIGEST,
    releaseEnv: process.env.IDENTITY_SHA,
    rollingTag: "test",
  },
  {
    repository: "lax-test-shop-identity",
    sha: process.env.SHOP_IDENTITY_SHA,
    digest: process.env.SHOP_IDENTITY_DIGEST,
    releaseEnv: process.env.SHOP_IDENTITY_SHA,
    rollingTag: "test",
  },
  {
    repository: "lax-test-shop",
    sha: process.env.SHOP_SHA,
    digest: process.env.SHOP_DIGEST,
    releaseEnv: process.env.SHOP_SHA,
    rollingTag: "test",
  },
];

const requiredInputs = [
  ["IDENTITY_SHA", process.env.IDENTITY_SHA],
  ["IDENTITY_DIGEST", process.env.IDENTITY_DIGEST],
  ["SHOP_IDENTITY_SHA", process.env.SHOP_IDENTITY_SHA],
  ["SHOP_IDENTITY_DIGEST", process.env.SHOP_IDENTITY_DIGEST],
  ["SHOP_SHA", process.env.SHOP_SHA],
  ["SHOP_DIGEST", process.env.SHOP_DIGEST],
];
const missingInputs = requiredInputs.filter(([, value]) => !value).map(([name]) => name);
if (missingInputs.length > 0) {
  throw new Error(`Missing required staging image contracts: ${missingInputs.join(", ")}`);
}

const manifestPath = process.env.RELEASE_MANIFEST;
if (manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const contract of contracts) {
    const entry = manifest.components?.find(
      (component) => component.repository === contract.repository,
    );
    if (!entry) {
      throw new Error(`Release manifest missing ${contract.repository}`);
    }
    if (entry.commitSha !== contract.sha || entry.digest !== contract.digest) {
      throw new Error(
        `Release manifest mismatch for ${contract.repository}: ${entry.commitSha}@${entry.digest}`,
      );
    }
  }
}

const verifyRolling = process.env.VERIFY_ROLLING_TAGS === "true";

for (const contract of contracts) {
  verifyImmutableContract(contract);
  if (verifyRolling) {
    await waitForTagDigest(contract.repository, contract.rollingTag, contract.digest);
  }
}

const outputPath = process.env.RELEASE_MANIFEST_OUT;
if (outputPath) {
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        environment: process.env.ENVIRONMENT ?? "test",
        registry,
        components: contracts.map((contract) => ({
          repository: contract.repository,
          commitSha: contract.sha,
          digest: contract.digest,
          rollingTag: contract.rollingTag,
        })),
      },
      null,
      2,
    )}\n`,
  );
}

console.log("Staging image contracts verified for Identity, Shop Identity, and Shop");

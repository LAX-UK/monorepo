#!/usr/bin/env node
import { spawnSync } from "node:child_process";

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
  },
  {
    repository: "lax-test-shop-identity",
    sha: process.env.SHOP_IDENTITY_SHA,
    digest: process.env.SHOP_IDENTITY_DIGEST,
    releaseEnv: process.env.SHOP_IDENTITY_SHA,
  },
  {
    repository: "lax-test-shop",
    sha: process.env.SHOP_SHA,
    digest: process.env.SHOP_DIGEST,
    releaseEnv: process.env.SHOP_SHA,
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

function listTags(repository) {
  const result = spawnSync(
    "doctl",
    ["registry", "repository", "list-tags", repository, "--output", "json"],
    { encoding: "utf8" },
  );
  if (result.status !== 0 || !result.stdout) {
    throw new Error(`Could not list tags for ${repository}`);
  }
  return JSON.parse(result.stdout);
}

function digestForTag(tags, tag) {
  return tags.find((entry) => entry.tag === tag)?.manifest_digest ?? null;
}

for (const contract of contracts) {
  if (!/^[0-9a-f]{40}$/.test(contract.sha)) {
    throw new Error(`${contract.repository} SHA is invalid`);
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(contract.digest)) {
    throw new Error(`${contract.repository} digest is invalid`);
  }

  const tags = listTags(contract.repository);
  const shaDigest = digestForTag(tags, contract.sha);
  const rollingDigest = digestForTag(tags, "test");
  if (shaDigest !== contract.digest) {
    throw new Error(
      `${contract.repository} immutable tag ${contract.sha} resolves to ${shaDigest}, expected ${contract.digest}`,
    );
  }
  if (rollingDigest !== contract.digest) {
    throw new Error(
      `${contract.repository} rolling tag test resolves to ${rollingDigest}, expected ${contract.digest}`,
    );
  }

  const image = `${registry}/${contract.repository}@${contract.digest}`;
  const pull = spawnSync("docker", ["pull", image], { stdio: "inherit" });
  if (pull.status !== 0) throw new Error(`Could not pull ${image}`);

  const inspect = spawnSync("docker", ["image", "inspect", image], { encoding: "utf8" });
  if (inspect.status !== 0 || !inspect.stdout) {
    throw new Error(`Could not inspect ${image}`);
  }
  const env = JSON.parse(inspect.stdout)[0]?.Config?.Env ?? [];
  const release = env
    .find((entry) => entry.startsWith("SENTRY_RELEASE="))
    ?.slice("SENTRY_RELEASE=".length);
  if (release !== contract.releaseEnv) {
    throw new Error(`${contract.repository} embedded release ${release} != ${contract.releaseEnv}`);
  }
}

console.log("Staging image contracts verified for Identity, Shop Identity, and Shop");

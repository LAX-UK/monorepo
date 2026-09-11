#!/usr/bin/env node
/**
 * Poll DOCR until an alias resolves to the expected digest, or fail with diagnostics.
 */
import { spawnSync } from "node:child_process";

const registry = (process.env.DOCR_REGISTRY ?? "registry.digitalocean.com/lax-bid").replace(
  /\/+$/,
  "",
);

export function listTags(repository) {
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

export function digestForTag(tags, tag) {
  return tags.find((entry) => entry.tag === tag)?.manifest_digest ?? null;
}

export async function waitForTagDigest(repository, tag, expectedDigest, options = {}) {
  const maxAttempts = options.maxAttempts ?? 8;
  let delayMs = options.initialDelayMs ?? 1_000;
  let lastActual = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const tags = listTags(repository);
    lastActual = digestForTag(tags, tag);
    if (lastActual === expectedDigest) {
      return lastActual;
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 30_000);
    }
  }

  throw new Error(
    `${repository}:${tag} resolves to ${lastActual}, expected ${expectedDigest} after ${maxAttempts} attempts`,
  );
}

export function verifyImmutableContract({ repository, sha, digest, releaseEnv }) {
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`${repository} SHA is invalid`);
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new Error(`${repository} digest is invalid`);
  }

  const tags = listTags(repository);
  const shaDigest = digestForTag(tags, sha);
  if (shaDigest !== digest) {
    throw new Error(
      `${repository} immutable tag ${sha} resolves to ${shaDigest}, expected ${digest}`,
    );
  }

  const image = `${registry}/${repository}@${digest}`;
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
  if (release !== releaseEnv) {
    throw new Error(`${repository} embedded release ${release} != ${releaseEnv}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repository = process.argv[2];
  const tag = process.argv[3];
  const digest = process.argv[4];
  if (!repository || !tag || !digest) {
    throw new Error("usage: registry-tag-poll.mjs <repository> <tag> <digest>");
  }
  await waitForTagDigest(repository, tag, digest);
  console.log(`${repository}:${tag} resolved to ${digest}`);
}

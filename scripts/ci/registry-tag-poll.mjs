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

export async function waitForShaTag(repository, sha, options = {}) {
  const maxAttempts = options.maxAttempts ?? 12;
  let delayMs = options.initialDelayMs ?? 5_000;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const digest = digestForTag(listTags(repository), sha);
    if (digest) {
      return digest;
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 30_000);
    }
  }
  throw new Error(
    `DOCR ${repository} is missing immutable tag ${sha} after ${maxAttempts} attempts; build-images must finish before deploy`,
  );
}

/**
 * The digest a tag resolves to, asked of the registry itself (a manifest HEAD request).
 * DOCR's tag listing can keep showing an alias on its previous image after the registry has
 * moved it, so a listing mismatch is checked here before it counts. Null when the registry
 * can't be asked (no doctl login, network error); the listing answer then stands.
 */
export async function registryDigestForTag(repository, tag, deps = {}) {
  const readDockerConfig = deps.readDockerConfig ?? defaultReadDockerConfig;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const auth = readDockerConfig();
  if (!auth || !fetchImpl) return null;
  const [host, ...path] = registry.split("/");
  const name = [...path, repository].join("/");
  const url = `https://${host}/v2/${name}/manifests/${encodeURIComponent(tag)}`;
  try {
    const bearer = await pullToken(fetchImpl, url, auth, name);
    if (!bearer) return null;
    const res = await fetchImpl(url, {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: [
          "application/vnd.oci.image.index.v1+json",
          "application/vnd.docker.distribution.manifest.list.v2+json",
          "application/vnd.oci.image.manifest.v1+json",
          "application/vnd.docker.distribution.manifest.v2+json",
        ].join(", "),
      },
    });
    if (!res.ok) return null;
    return res.headers.get("docker-content-digest");
  } catch {
    return null;
  }
}

/** Registry token flow: the 401 names the auth realm; Basic credentials buy a pull-scoped token. */
async function pullToken(fetchImpl, url, basicAuth, name) {
  const challenge = await fetchImpl(url, { method: "HEAD" });
  const header = challenge.headers.get("www-authenticate") ?? "";
  const realm = /realm="([^"]+)"/.exec(header)?.[1];
  const service = /service="([^"]+)"/.exec(header)?.[1];
  if (!realm) return null;
  const tokenUrl = new URL(realm);
  if (service) tokenUrl.searchParams.set("service", service);
  tokenUrl.searchParams.set("scope", `repository:${name}:pull`);
  const res = await fetchImpl(tokenUrl, { headers: { Authorization: `Basic ${basicAuth}` } });
  if (!res.ok) return null;
  const body = await res.json();
  return body.token ?? body.access_token ?? null;
}

function defaultReadDockerConfig() {
  const result = spawnSync("doctl", ["registry", "docker-config", "--expiry-seconds", "600"], {
    encoding: "utf8",
  });
  if (result.status !== 0 || !result.stdout) return null;
  try {
    const host = registry.split("/")[0];
    return JSON.parse(result.stdout)?.auths?.[host]?.auth ?? null;
  } catch {
    return null;
  }
}

export async function waitForTagDigest(repository, tag, expectedDigest, options = {}) {
  const maxAttempts = options.maxAttempts ?? 8;
  let delayMs = options.initialDelayMs ?? 1_000;
  let lastActual = null;
  const askRegistry = options.registryDigestForTag ?? registryDigestForTag;
  const list = options.listTags ?? listTags;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const tags = list(repository);
    lastActual = digestForTag(tags, tag);
    if (lastActual === expectedDigest) {
      return lastActual;
    }
    const fromRegistry = await askRegistry(repository, tag);
    if (fromRegistry === expectedDigest) {
      console.log(
        `${repository}:${tag} listing still shows ${lastActual}; the registry resolves it to ${expectedDigest}`,
      );
      return fromRegistry;
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

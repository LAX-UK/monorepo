import assert from "node:assert/strict";
import test from "node:test";
import { digestForTag } from "./registry-tag-poll.mjs";

test("digestForTag finds matching tag entry", () => {
  const tags = [
    { tag: "abc", manifest_digest: "sha256:111" },
    { tag: "test", manifest_digest: "sha256:111" },
  ];
  assert.equal(digestForTag(tags, "abc"), "sha256:111");
  assert.equal(digestForTag(tags, "missing"), null);
});

test("waitForTagDigest accepts the registry's answer when the tag listing is stale", async () => {
  const { waitForTagDigest } = await import("./registry-tag-poll.mjs");
  const digest = await waitForTagDigest("lax-test-web", "test", "sha256:new", {
    maxAttempts: 1,
    listTags: () => [{ tag: "test", manifest_digest: "sha256:old" }],
    registryDigestForTag: async () => "sha256:new",
  });
  assert.equal(digest, "sha256:new");
});

test("waitForTagDigest still fails when the registry agrees the tag is elsewhere", async () => {
  const { waitForTagDigest } = await import("./registry-tag-poll.mjs");
  await assert.rejects(
    waitForTagDigest("lax-test-web", "test", "sha256:new", {
      maxAttempts: 1,
      listTags: () => [{ tag: "test", manifest_digest: "sha256:old" }],
      registryDigestForTag: async () => "sha256:old",
    }),
    /resolves to sha256:old, expected sha256:new/,
  );
});

test("registryDigestForTag reads the digest header from a manifest HEAD request", async () => {
  const { registryDigestForTag } = await import("./registry-tag-poll.mjs");
  let seen;
  const digest = await registryDigestForTag("lax-test-web", "test", {
    readDockerConfig: () => "dG9rZW46dG9rZW4=",
    fetchImpl: async (url, init = {}) => {
      const target = String(url);
      if (target.startsWith("https://api.example/auth")) {
        assert.match(target, /scope=repository%3Alax-bid%2Flax-test-web%3Apull/);
        return { ok: true, json: async () => ({ token: "pull-token" }) };
      }
      if (!init.headers?.Authorization) {
        return {
          ok: false,
          headers: new Map([
            [
              "www-authenticate",
              'Bearer realm="https://api.example/auth",service="registry.digitalocean.com"',
            ],
          ]),
        };
      }
      seen = { url: target, init };
      return { ok: true, headers: new Map([["docker-content-digest", "sha256:abc"]]) };
    },
  });
  assert.equal(digest, "sha256:abc");
  assert.equal(seen.init.method, "HEAD");
  assert.equal(seen.init.headers.Authorization, "Bearer pull-token");
  assert.match(
    seen.url,
    /^https:\/\/registry\.digitalocean\.com\/v2\/lax-bid\/lax-test-web\/manifests\/test$/,
  );
});

test("registryDigestForTag returns null without a registry login", async () => {
  const { registryDigestForTag } = await import("./registry-tag-poll.mjs");
  assert.equal(
    await registryDigestForTag("lax-test-web", "test", { readDockerConfig: () => null }),
    null,
  );
});

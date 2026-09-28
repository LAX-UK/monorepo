import assert from "node:assert/strict";
import test from "node:test";
import { listGithubSoakArtifacts } from "./list-github-soak-artifacts.mjs";

test("listGithubSoakArtifacts stops paging once artifacts are older than lookback", async () => {
  const now = Date.now();
  const recent = new Date(now - 60_000).toISOString();
  const stale = new Date(now - 96 * 60 * 60 * 1000).toISOString();
  let page = 0;
  const fetchImpl = async (_url) => {
    page += 1;
    const artifacts =
      page === 1
        ? [
            { name: "identity-staging-soak-sample-a".padEnd(40, "a"), created_at: recent },
            { name: "identity-staging-soak-maintenance-1", created_at: stale },
          ]
        : [];
    return {
      ok: true,
      json: async () => ({ artifacts }),
    };
  };

  const artifacts = await listGithubSoakArtifacts({
    token: "test",
    repository: "LAX-UK/monorepo",
    sinceMs: now - 72 * 60 * 60 * 1000,
    fetchFn: fetchImpl,
  });
  assert.equal(page, 1);
  assert.equal(artifacts.length, 1);
});

/**
 * Paginated GitHub Actions artifacts used by identity staging soak window resolution.
 */

const SOAK_LOOKBACK_MS = 72 * 60 * 60 * 1000;

/**
 * @param {{ token: string; repository: string; sinceMs?: number; fetchFn?: typeof fetch }} params
 * @returns {Promise<Array<{ id: number; name: string; created_at: string; expired: boolean; archive_download_url: string }>>}
 */
export async function listGithubSoakArtifacts({ token, repository, sinceMs, fetchFn = fetch }) {
  const lookbackMs = sinceMs ?? Date.now() - SOAK_LOOKBACK_MS;
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
  };
  const artifacts = [];
  for (let page = 1; ; page += 1) {
    const response = await fetchFn(
      `https://api.github.com/repos/${repository}/actions/artifacts?per_page=100&page=${page}`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`GitHub artifacts API failed (${response.status}): ${await response.text()}`);
    }
    const body = await response.json();
    let reachedOlderThanLookback = false;
    for (const artifact of body.artifacts) {
      const createdMs = Date.parse(artifact.created_at);
      if (Number.isFinite(createdMs) && createdMs < lookbackMs) {
        reachedOlderThanLookback = true;
        continue;
      }
      if (
        artifact.name.startsWith("identity-staging-soak-sample-") ||
        artifact.name.startsWith("identity-staging-soak-maintenance-") ||
        artifact.name.startsWith("identity-staging-soak-reset-")
      ) {
        artifacts.push(artifact);
      }
    }
    if (body.artifacts.length < 100 || reachedOlderThanLookback) break;
  }
  return artifacts;
}

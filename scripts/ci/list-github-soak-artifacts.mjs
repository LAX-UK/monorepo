/**
 * Paginated GitHub Actions artifacts used by identity staging soak window resolution.
 */

/**
 * @param {{ token: string; repository: string }} params
 * @returns {Promise<Array<{ id: number; name: string; created_at: string; expired: boolean; archive_download_url: string }>>}
 */
export async function listGithubSoakArtifacts({ token, repository }) {
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
  };
  const artifacts = [];
  for (let page = 1; ; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/actions/artifacts?per_page=100&page=${page}`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`GitHub artifacts API failed (${response.status}): ${await response.text()}`);
    }
    const body = await response.json();
    for (const artifact of body.artifacts) {
      if (
        artifact.name.startsWith("identity-staging-soak-sample-") ||
        artifact.name.startsWith("identity-staging-soak-maintenance-") ||
        artifact.name.startsWith("identity-staging-soak-reset-")
      ) {
        artifacts.push(artifact);
      }
    }
    if (body.artifacts.length < 100) break;
  }
  return artifacts;
}

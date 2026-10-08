#!/usr/bin/env node
/**
 * Roll back an App Platform app via validate → rollback → poll → commit.
 */
const DEFAULT_TIMEOUT_MS = 1_200_000;
const POLL_MS = 10_000;

function parseArgs(argv) {
  let appId = "";
  let deploymentId = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--app-id") appId = argv[++i] ?? "";
    if (argv[i] === "--deployment-id") deploymentId = argv[++i] ?? "";
  }
  if (!appId || !deploymentId) {
    throw new Error("--app-id and --deployment-id are required");
  }
  return { appId, deploymentId };
}

export async function rollbackAppPlatform({
  token,
  appId,
  deploymentId,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const validate = await fetchImpl(
    `https://api.digitalocean.com/v2/apps/${appId}/rollback/validate`,
    { method: "POST", headers, body: JSON.stringify({ deployment_id: deploymentId }) },
  );
  if (!validate.ok) {
    throw new Error(`rollback validate failed: ${validate.status} ${await validate.text()}`);
  }
  const rollback = await fetchImpl(`https://api.digitalocean.com/v2/apps/${appId}/rollback`, {
    method: "POST",
    headers,
    body: JSON.stringify({ deployment_id: deploymentId, skip_pin: false }),
  });
  if (!rollback.ok) {
    throw new Error(`rollback create failed: ${rollback.status} ${await rollback.text()}`);
  }
  const payload = await rollback.json();
  const newId = payload?.deployment?.id;
  if (!newId) throw new Error("rollback response missing deployment id");

  const deadline = Date.now() + timeoutMs;
  let phase = "";
  while (Date.now() < deadline) {
    const dep = await fetchImpl(
      `https://api.digitalocean.com/v2/apps/${appId}/deployments/${newId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!dep.ok) throw new Error(`get deployment failed: ${dep.status}`);
    const body = await dep.json();
    phase = body?.deployment?.phase ?? "";
    if (phase === "ACTIVE") break;
    if (phase === "ERROR" || phase === "CANCELED") {
      throw new Error(`rollback deployment ended in ${phase}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  if (phase !== "ACTIVE") {
    throw new Error(`rollback deployment timed out in phase ${phase || "unknown"}`);
  }

  const commit = await fetchImpl(`https://api.digitalocean.com/v2/apps/${appId}/rollback/commit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ deployment_id: newId }),
  });
  if (!commit.ok) {
    throw new Error(`rollback commit failed: ${commit.status} ${await commit.text()}`);
  }
  return { rollbackDeploymentId: newId, phase };
}

async function main() {
  const token = process.env.DIGITALOCEAN_TOKEN;
  if (!token) throw new Error("DIGITALOCEAN_TOKEN is required");
  const { appId, deploymentId } = parseArgs(process.argv.slice(2));
  const result = await rollbackAppPlatform({ token, appId, deploymentId });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

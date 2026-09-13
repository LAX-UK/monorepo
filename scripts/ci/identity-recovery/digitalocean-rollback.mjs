import { spawnSync } from "node:child_process";

function runDoctl(args) {
  const result = spawnSync("doctl", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "doctl command failed");
  }
  return result.stdout.trim();
}

export function listDeploymentIds(appId) {
  const output = runDoctl(["apps", "list-deployments", appId, "--output", "json"]);
  const deployments = JSON.parse(output);
  return deployments.map((deployment) => deployment.id);
}

export function activeDeploymentId(appId) {
  const output = runDoctl(["apps", "get", appId, "--output", "json"]);
  const app = JSON.parse(output)[0];
  return app?.active_deployment?.id ?? "";
}

export function validateRollback(appId, deploymentId) {
  runDoctl(["apps", "rollback", "validate", appId, deploymentId]);
}

export function commitRollback(appId, deploymentId) {
  runDoctl(["apps", "rollback", "commit", appId, deploymentId, "--wait"]);
}

export function revertRollback(appId) {
  runDoctl(["apps", "rollback", "revert", appId, "--wait"]);
}

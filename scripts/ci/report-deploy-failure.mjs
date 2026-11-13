#!/usr/bin/env node
/**
 * Explain a failed App Platform deployment: name the failed components first, then print their
 * deploy and run log tails, then the remaining components. The component list comes from the
 * deployment's own spec (plus the tag map when given), so new components are covered without
 * editing a hard-coded list. Env values are never printed; secret-looking assignments are masked.
 */
import { spawnSync } from "node:child_process";

const SECRET_ASSIGNMENT =
  /\b([A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|KEY|DSN|CREDENTIAL|DATABASE_URL|REDIS_URL)[A-Za-z0-9_]*)\s*([=:])\s*\S+/gi;
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi;

/** Mask values that look like secrets; names stay so "missing X" messages remain useful. */
export function redactLine(line) {
  return line.replace(SECRET_ASSIGNMENT, "$1$2 ***").replace(URL_CREDENTIALS, "$1***@");
}

function firstDeployment(payload) {
  return Array.isArray(payload) ? payload[0] : payload;
}

/** Component names from the deployment spec, merged with the tag map keys. */
export function componentNames(deploymentPayload, tagMap = {}) {
  const spec = firstDeployment(deploymentPayload)?.spec ?? {};
  const names = new Set(Object.keys(tagMap));
  for (const kind of ["services", "workers", "jobs", "static_sites", "functions"]) {
    for (const entry of spec[kind] ?? []) {
      if (entry?.name) names.add(entry.name);
    }
  }
  return [...names];
}

function* walkSteps(steps) {
  for (const step of steps ?? []) {
    yield step;
    yield* walkSteps(step.steps);
  }
}

/** Longest known component name that the step name starts with, at a word boundary. */
function componentForStep(step, components) {
  if (step.component_name && components.includes(step.component_name)) {
    return step.component_name;
  }
  const name = step.name ?? "";
  const matches = components.filter(
    (component) =>
      name === component || name.startsWith(`${component}-`) || name.startsWith(`${component}.`),
  );
  return matches.sort((a, b) => b.length - a.length)[0];
}

/**
 * Failed steps with their reason, and the components they belong to.
 * @returns {{ failures: { step: string; reason: string; component?: string }[]; failedComponents: string[] }}
 */
export function summariseFailure(deploymentPayload, components) {
  const progress = firstDeployment(deploymentPayload)?.progress;
  const failures = [];
  for (const step of walkSteps(progress?.steps)) {
    if (step.status !== "ERROR") continue;
    // A parent step only repeats its failing child; report the leaf.
    if ([...walkSteps(step.steps)].some((child) => child.status === "ERROR")) continue;
    failures.push({
      step: step.name ?? "unknown",
      reason: step.reason?.message ?? step.reason ?? step.message ?? "no reason reported",
      component: componentForStep(step, components),
    });
  }
  const failedComponents = [...new Set(failures.map((f) => f.component).filter(Boolean))];
  return { failures, failedComponents };
}

export function formatFailureSummary(phase, { failures, failedComponents }) {
  const lines = [`App Platform deployment ended in phase ${phase}`];
  lines.push(
    failedComponents.length > 0
      ? `Failed components: ${failedComponents.join(", ")}`
      : "Failed components: not identified from the deployment steps",
  );
  for (const failure of failures) {
    lines.push(`  ${failure.step}: ${redactLine(String(failure.reason))}`);
  }
  return lines.join("\n");
}

/** Failed components first, then the rest in spec order. */
export function orderComponents(components, failedComponents) {
  const failed = components.filter((c) => failedComponents.includes(c));
  return [...failed, ...components.filter((c) => !failedComponents.includes(c))];
}

function doctl(args) {
  const result = spawnSync("doctl", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function printLogs(appId, deploymentId, component, type, tail) {
  const output = doctl([
    "apps",
    "logs",
    appId,
    component,
    "--type",
    type,
    "--tail",
    String(tail),
    "--deployment",
    deploymentId,
  ]);
  const lines = output.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return;
  console.log(`--- ${component} ${type} logs (last ${lines.length}) ---`);
  for (const line of lines) console.log(redactLine(line));
}

function parseArgs(argv) {
  const args = { appId: "", deploymentId: "", phase: "ERROR", tagMap: {} };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--app-id") args.appId = argv[++i] ?? "";
    else if (argv[i] === "--deployment-id") args.deploymentId = argv[++i] ?? "";
    else if (argv[i] === "--phase") args.phase = argv[++i] ?? "ERROR";
    else if (argv[i] === "--tag-map") args.tagMap = JSON.parse(argv[++i] || "{}");
  }
  if (!args.appId || !args.deploymentId) {
    throw new Error("--app-id and --deployment-id are required");
  }
  return args;
}

function main() {
  const { appId, deploymentId, phase, tagMap } = parseArgs(process.argv.slice(2));
  let payload = [];
  try {
    payload = JSON.parse(
      doctl(["apps", "get-deployment", appId, deploymentId, "--output", "json"]),
    );
  } catch {
    console.log("Could not read the deployment details; printing logs for every tagged component.");
  }
  const components = componentNames(payload, tagMap);
  const summary = summariseFailure(payload, components);
  const message = formatFailureSummary(phase, summary);
  console.log(`::error::${message.split("\n")[0]}; ${message.split("\n")[1]}`);
  console.log(message);
  for (const component of orderComponents(components, summary.failedComponents)) {
    printLogs(appId, deploymentId, component, "deploy", 100);
    printLogs(appId, deploymentId, component, "run", 100);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();

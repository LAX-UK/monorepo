#!/usr/bin/env node
/**
 * Poll public readiness URLs and optional release SHA contracts.
 */
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  let urlsJson = "[]";
  let expectedJson = "{}";
  let attempts = 60;
  let intervalSeconds = 10;
  let appId = "";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--urls") {
      urlsJson = argv[index + 1] ?? "[]";
      index += 1;
      continue;
    }
    if (arg === "--expected-releases") {
      expectedJson = argv[index + 1] ?? "{}";
      index += 1;
      continue;
    }
    if (arg === "--attempts") {
      attempts = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--interval-seconds") {
      intervalSeconds = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--app-id") {
      appId = argv[index + 1] ?? "";
      index += 1;
    }
  }
  return {
    urls: JSON.parse(urlsJson),
    expected: JSON.parse(expectedJson),
    attempts,
    intervalSeconds,
    appId,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchReady(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      status: body.status ?? "",
      release: body.release ?? "",
      body,
    };
  } catch {
    return { ok: false, status: "", release: "", body: null };
  } finally {
    clearTimeout(timer);
  }
}

function specReleaseOverride(spec) {
  for (const component of spec?.services ?? []) {
    for (const env of component.envs ?? component.env ?? []) {
      if (env.key === "SENTRY_RELEASE") {
        return { component: component.name ?? "unknown", value: env.value ?? "" };
      }
    }
  }
  return null;
}

function printDiagnostics(appId, actualRelease) {
  if (!appId) return;
  const appJson = spawnSync("doctl", ["apps", "get", appId, "--output", "json"], {
    encoding: "utf8",
  });
  if (appJson.stdout) {
    try {
      const parsed = JSON.parse(appJson.stdout);
      const spec = Array.isArray(parsed) ? parsed[0]?.spec : parsed.spec;
      const web = spec?.services?.find((service) => service.name === "web");
      if (web?.image) {
        console.error(
          `web image tag: ${web.image.tag ?? "unknown"} registry: ${web.image.registry ?? "unknown"}`,
        );
      }
      const override = specReleaseOverride(spec);
      if (override && actualRelease && override.value === actualRelease) {
        console.error(
          `cause: spec env override — ${override.component} SENTRY_RELEASE=${override.value} overrides image-owned release`,
        );
      }
    } catch {
      // ignore
    }
  }
  const deployments = spawnSync("doctl", ["apps", "list-deployments", appId, "--output", "json"], {
    encoding: "utf8",
  });
  if (deployments.stdout) {
    try {
      const list = JSON.parse(deployments.stdout);
      const latest = Array.isArray(list) ? list[0] : list;
      if (latest?.id) {
        console.error(`latest deployment: ${latest.id} phase ${latest.phase ?? "unknown"}`);
      }
    } catch {
      // ignore
    }
  }
}

async function main() {
  const { urls, expected, attempts, intervalSeconds, appId } = parseArgs(process.argv.slice(2));
  for (const url of urls) {
    const expectedRelease = expected[url] ?? "";
    let actualRelease = "";
    let status = "";
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const result = await fetchReady(url);
      actualRelease = result.release;
      status = result.status;
      if (status === "ok" && (!expectedRelease || actualRelease === expectedRelease)) {
        console.log(`Readiness ok for ${url}${expectedRelease ? ` release ${actualRelease}` : ""}`);
        break;
      }
      if (attempt < attempts) {
        await sleep(intervalSeconds * 1_000);
      }
    }
    if (status !== "ok" || (expectedRelease && actualRelease !== expectedRelease)) {
      console.error(
        `Readiness contract failed for ${url}: expected release ${expectedRelease || "any"}, actual ${actualRelease || "missing"}`,
      );
      printDiagnostics(appId, actualRelease);
      process.exit(1);
    }
  }
}

main();

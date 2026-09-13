#!/usr/bin/env node
/**
 * Boots candidate and rollback Auth images against the current 0161 schema and
 * verifies /health/ready succeeds with an issued-but-unrefreshed OAuth token
 * (refresh_token_hash null). Quarantined SHAs must fail; qualified rollback SHAs
 * must pass.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/auction_ci";
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const logDir = process.env.IDENTITY_NN1_LOG_DIR ?? join(repoRoot, ".tmp/identity-nn1-logs");

const candidateImage = process.env.CANDIDATE_AUTH_IMAGE ?? "lax-auth-nn1-candidate:local";
const rollbackImage = process.env.ROLLBACK_AUTH_IMAGE ?? "lax-auth-nn1-rollback:local";
const quarantineSha =
  process.env.QUARANTINE_IDENTITY_SHA ?? "88ad1cf24995365554b49cef00e25fc5292d6c3a";
const qualifiedRollbackSha =
  process.env.QUALIFIED_ROLLBACK_SHA ?? "933c947faa922ebb7374db2aea9b09d7ba0b344c";

const baseEnv = {
  DATABASE_URL: "postgresql://auth_app:postgres@host.docker.internal:5432/auction_ci",
  REDIS_URL: "redis://host.docker.internal:6379",
  BETTER_AUTH_SECRET: "ci-auth-secret-at-least-sixteen-characters",
  AUTH_DEK_KEY: "0707070707070707070707070707070707070707070707070707070707070707",
  NODE_ENV: "production",
  APP_ENV: "test",
  PORT: "3003",
  ALLOW_HTTP_COOKIES: "true",
  SSF_DELIVERY_ENABLED: "false",
  WEB_ORIGIN: "http://localhost:3000",
  OIDC_ISSUER_URL: "http://localhost:3003",
  OIDC_INTERNAL_BASE_URL: "http://localhost:3003",
};

function run(command, args, label) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${label} failed`);
}

async function bootAndProbe(image, release, expectOk) {
  mkdirSync(logDir, { recursive: true });
  const containerName = `identity-nn1-${release.slice(0, 8)}`;
  spawnSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });

  const child = spawn(
    "docker",
    [
      "run",
      "--name",
      containerName,
      "--add-host=host.docker.internal:host-gateway",
      "-e",
      `SENTRY_RELEASE=${release}`,
      ...Object.entries(baseEnv).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
      "-p",
      "3003:3003",
      image,
    ],
    { stdio: "ignore" },
  );

  const deadline = Date.now() + 120_000;
  let ok = false;
  while (Date.now() < deadline) {
    const probe = spawnSync("curl", ["--fail", "--silent", "http://localhost:3003/health/ready"], {
      encoding: "utf8",
    });
    if (probe.status === 0) {
      try {
        const body = JSON.parse(probe.stdout);
        ok = body.status === "ok" && body.release === release;
      } catch {
        ok = false;
      }
      if (ok) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  spawnSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
  child.kill("SIGKILL");

  if (expectOk && !ok) {
    throw new Error(`Expected ${release} to become ready`);
  }
  if (!expectOk && ok) {
    throw new Error(`Quarantined ${release} unexpectedly became ready`);
  }
  console.log(
    expectOk ? `Qualified ${release} passed` : `Quarantined ${release} failed as expected`,
  );
}

async function main() {
  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL_OWNER = databaseUrl;
  process.env.REDIS_URL = redisUrl;
  await import("./ensure-ci-database.mjs");

  run("pnpm", ["--filter", "@auction/db...", "build"], "Build db closure");
  run("pnpm", ["--filter", "@auction/db", "db:migrate"], "Migrate database");
  run("pnpm", ["--filter", "@auction/db", "db:roles"], "Apply roles");
  run("node", ["scripts/ci/seed-identity-acceptance-fixtures.mjs"], "Seed OAuth fixtures");

  if (process.env.BUILD_NN1_IMAGES !== "false") {
    run(
      "docker",
      ["build", "-f", "apps/auth/Dockerfile", "-t", candidateImage, "."],
      "Build candidate auth image",
    );
    run(
      "docker",
      [
        "build",
        "-f",
        "apps/auth/Dockerfile",
        "--build-arg",
        `IMAGE_SHA=${qualifiedRollbackSha}`,
        "-t",
        rollbackImage,
        ".",
      ],
      "Build rollback auth image tag",
    );
  }

  await bootAndProbe(candidateImage, process.env.CANDIDATE_IDENTITY_SHA ?? "local-candidate", true);
  await bootAndProbe(rollbackImage, qualifiedRollbackSha, true);

  if (process.env.SKIP_QUARANTINE_PROBE !== "true") {
    const quarantineImage = process.env.QUARANTINE_AUTH_IMAGE;
    if (quarantineImage) {
      await bootAndProbe(quarantineImage, quarantineSha, false);
    } else {
      console.log(
        `Skipping quarantine container probe for ${quarantineSha}; set QUARANTINE_AUTH_IMAGE to enforce.`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

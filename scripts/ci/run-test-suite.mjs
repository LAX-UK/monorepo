#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";

function runSync(args) {
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
    env: { ...process.env, CI: process.env.CI ?? "true" },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runShard(shard, total) {
  return new Promise((resolvePromise) => {
    const child = spawn(
      "pnpm",
      ["--filter", "@auction/web", "exec", "vitest", "run", `--shard=${shard}/${total}`],
      {
        env: { ...process.env, CI: process.env.CI ?? "true" },
      },
    );

    /** @type {Buffer[]} */
    const chunks = [];
    child.stdout?.on("data", (chunk) => chunks.push(chunk));
    child.stderr?.on("data", (chunk) => chunks.push(chunk));

    child.on("close", (code) => {
      resolvePromise({ shard, code: code ?? 1, output: Buffer.concat(chunks).toString("utf8") });
    });
  });
}

async function runWebShards(total = 4) {
  if (process.env.CI_SKIP_WEB_VITEST_SHARDS === "1") {
    console.log("Skipping web Vitest shards (CI_SKIP_WEB_VITEST_SHARDS=1).");
    return;
  }

  const defaultConcurrency = process.env.CI ? "1" : "2";
  const concurrency = Math.max(
    1,
    Number.parseInt(process.env.WEB_TEST_SHARD_CONCURRENCY ?? defaultConcurrency, 10),
  );
  console.log(`Running web Vitest with ${total} shards (concurrency ${concurrency})`);

  /** @type {Array<{ shard: number, code: number, output: string }>} */
  const results = [];
  for (let start = 1; start <= total; start += concurrency) {
    const batch = [];
    for (let shard = start; shard < start + concurrency && shard <= total; shard += 1) {
      console.log(`Starting web Vitest shard ${shard}/${total}`);
      batch.push(runShard(shard, total));
    }
    results.push(...(await Promise.all(batch)));
  }

  const failed = results.filter((r) => r.code !== 0);
  if (failed.length === 0) return;

  console.error("\nWeb Vitest shard failures:\n");
  for (const result of failed) {
    console.error(`--- shard ${result.shard}/${total} (exit ${result.code}) ---`);
    console.error(result.output);
  }
  process.exit(1);
}

function warnSkippedShopDbIntegrationSuites() {
  const required = ["MIGRATION_TEST_DATABASE_URL", "DATABASE_URL_SHOP"];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length === 0) {
    return;
  }
  const suiteCount = 7;
  console.warn(
    `\n[run-test-suite] WARNING: ${suiteCount} @auction/shop-api PostgreSQL integration suites will be SKIPPED.`,
  );
  console.warn(
    `[run-test-suite] Missing env: ${missing.join(", ")}. Local green runs do not prove DB integration coverage.\n`,
  );
}

warnSkippedShopDbIntegrationSuites();

// Shop Vitest (jsdom + Next) starves under parallel @auction/api; run it in isolation.
runSync(["turbo", "run", "test", "--filter=!@auction/web", "--filter=!@auction/shop"]);
runSync(["turbo", "run", "test", "--filter=@auction/shop"]);
runSync(["turbo", "run", "build", "--filter=@auction/web..."]);
await runWebShards(4);

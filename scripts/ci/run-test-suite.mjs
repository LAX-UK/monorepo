#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function run(args) {
  const result = spawnSync("pnpm", args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["turbo", "run", "test", "--filter=!@auction/web"]);
run(["turbo", "run", "build", "--filter=@auction/web..."]);
for (let shard = 1; shard <= 4; shard += 1) {
  console.log(`Running web Vitest shard ${shard}/4`);
  run(["--filter", "@auction/web", "exec", "vitest", "run", `--shard=${shard}/4`]);
}

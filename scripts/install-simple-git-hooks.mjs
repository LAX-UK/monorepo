#!/usr/bin/env node
import { spawnSync } from "node:child_process";
/**
 * Installs git hooks when simple-git-hooks is present (dev install).
 * No-op during Docker prod installs and other contexts without the devDependency.
 */
import { existsSync } from "node:fs";

const bin = "node_modules/simple-git-hooks/package.json";
if (!existsSync(bin)) {
  process.exit(0);
}

const result = spawnSync("simple-git-hooks", { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { IDENTITY_FILTER_PATHS } from "./closure.mjs";

const COPY_EXCLUDED_SEGMENTS = new Set([".turbo", "coverage", "dist", "node_modules"]);

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout || result.error?.message}`,
    );
  }
  return result.stdout.trim();
}

function assertEmptyDestination(destination) {
  if (!existsSync(destination)) return;
  if (readdirSync(destination).length > 0) {
    throw new Error(`Extraction destination must not exist or must be empty: ${destination}`);
  }
  rmSync(destination, { recursive: true, force: true });
}

function overlayWorkingTree(sourceRoot, destination) {
  for (const path of IDENTITY_FILTER_PATHS) {
    const source = join(sourceRoot, path);
    const target = join(destination, path);
    if (!existsSync(source)) {
      rmSync(target, { recursive: true, force: true });
      continue;
    }
    rmSync(target, { recursive: true, force: true });
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, {
      recursive: true,
      filter(candidate) {
        const candidatePath = relative(source, candidate);
        return !candidatePath.split(sep).some((segment) => COPY_EXCLUDED_SEGMENTS.has(segment));
      },
    });
  }
}

export function extractIdentityHistory({
  sourceRoot,
  destination,
  includeWorkingTree = true,
  dryRun = false,
}) {
  const filterArguments = IDENTITY_FILTER_PATHS.flatMap((path) => ["--path", path]);
  if (dryRun) {
    return [
      `git clone --template= --no-local --no-tags --single-branch ${sourceRoot} ${destination}`,
      `git filter-repo --force ${filterArguments.join(" ")}`,
      ...(includeWorkingTree ? ["overlay approved working-tree paths"] : []),
    ];
  }

  assertEmptyDestination(destination);
  run(
    "git",
    ["clone", "--template=", "--no-local", "--no-tags", "--single-branch", sourceRoot, destination],
    sourceRoot,
  );
  run("git", ["filter-repo", "--force", ...filterArguments], destination);

  if (includeWorkingTree) overlayWorkingTree(sourceRoot, destination);

  return destination;
}

#!/usr/bin/env node
/**
 * Plans the base build behind the "Route JS: base vs head" table, and decides what a missing base
 * means. The CI steps call it instead of carrying the logic inline, so it is tested
 * (`route-js-size-base.test.mjs`). The base itself is built by `route-js-size-build-base.sh`.
 *
 * Usage:
 *   node scripts/route-js-size-base.mjs plan --head-report <head.json> --base <sha>
 *                                            [--changed-files <file>] [--root <dir>]
 *     Prints, or appends to GITHUB_OUTPUT when it is set:
 *       apps=<apps the head report has that exist at the base, space-separated>
 *       filters=<the matching turbo --filter flags>
 *       key=<the apps joined, for cache keys>
 *       head_apps=, head_filters=<every app in the head report, for the self-check>
 *       self_check=<true when the PR changes what a size build depends on>
 *   node scripts/route-js-size-base.mjs missing-base [--title <t>] [--labels <l>]
 *                                                    [--changed-files <file>]
 *     The base could not be built: warns, and fails a motion or performance PR, whose proof is
 *     missing. Title and labels default to PR_TITLE and PR_LABELS.
 *
 * Exit codes: 0 done, 1 a motion or performance PR has no base, 2 bad usage.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  UsageError,
  noGrowthReason,
  parseLabels,
  readChangedFiles,
} from "./route-js-size-compare.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Files a size build depends on beyond app source: the CI settings, turbo's task config, the
 * measuring scripts, each app's Next config, the toolchain and the dependency lockfile. A PR that
 * changes one of them also runs the self-check (the head built a second time through the base
 * route, which must change no route).
 */
export function touchesSizeBuild(file) {
  return (
    file === ".github/workflows/ci.yml" ||
    file === "turbo.json" ||
    file === "package.json" ||
    file === "pnpm-lock.yaml" ||
    file === ".nvmrc" ||
    /^scripts\/route-js-[^/]+$/.test(file) ||
    /^apps\/[^/]+\/next\.config\.[cm]?[jt]s$/.test(file)
  );
}

/**
 * The apps to build at the base: those in the head report that exist at the base commit, with
 * their package names for turbo filters. `exists(app)` and `packageName(app)` are injected so the
 * rule is testable without git.
 */
export function planBase({ headApps, exists, packageName, changedFiles = [] }) {
  const apps = headApps.filter((app) => exists(app));
  const filters = (list) => list.map((app) => `--filter=${packageName(app)}`).join(" ");
  return {
    apps: apps.join(" "),
    filters: filters(apps),
    key: apps.join("+").replaceAll("/", "-"),
    head_apps: headApps.join(" "),
    head_filters: filters(headApps),
    self_check: String(headApps.length > 0 && changedFiles.some(touchesSizeBuild)),
  };
}

function parseOptions(argv, known) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const name = arg.replace(/^--/, "");
    if (!arg.startsWith("--") || !known.includes(name))
      throw new UsageError(`unknown option ${arg}`);
    const next = argv[++i];
    if (next === undefined) throw new UsageError(`${arg} needs a value`);
    options[name] = next;
  }
  return options;
}

function plan(argv, { env, log }) {
  const options = parseOptions(argv, ["head-report", "base", "changed-files", "root"]);
  if (!options["head-report"] || !options.base) {
    throw new UsageError("plan needs --head-report and --base");
  }
  const root = path.resolve(options.root ?? ROOT);
  let headApps;
  try {
    headApps = Object.keys(JSON.parse(readFileSync(options["head-report"], "utf8")).apps);
  } catch (error) {
    throw new UsageError(`cannot read the head report: ${error.message}`);
  }
  const result = planBase({
    headApps,
    exists: (app) => {
      try {
        execFileSync("git", ["cat-file", "-e", `${options.base}:${app}/package.json`], {
          cwd: root,
          stdio: "ignore",
        });
        return true;
      } catch {
        return false;
      }
    },
    packageName: (app) =>
      JSON.parse(readFileSync(path.join(root, app, "package.json"), "utf8")).name,
    changedFiles: readChangedFiles(options["changed-files"]),
  });
  const text = `${Object.entries(result)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, text);
  log(text.trimEnd());
  return 0;
}

function missingBase(argv, { env, log }) {
  const options = parseOptions(argv, ["title", "labels", "changed-files"]);
  const reason = noGrowthReason({
    title: options.title ?? env.PR_TITLE ?? "",
    labels: parseLabels(options.labels ?? env.PR_LABELS ?? ""),
    changedFiles: readChangedFiles(options["changed-files"]),
  });
  log(
    "::warning title=Route JS vs base::The base could not be built, so there is no base-vs-head table.",
  );
  if (!reason) return 0;
  log(
    `error: this PR counts as motion or performance work (${reason}) and must show no route growth against its base; re-run the job`,
  );
  return 1;
}

export function main(argv, { env = process.env, log = console.log } = {}) {
  const [command, ...rest] = argv;
  try {
    if (command === "plan") return plan(rest, { env, log });
    if (command === "missing-base") return missingBase(rest, { env, log });
    throw new UsageError(`unknown command ${command ?? "(none)"}; use plan or missing-base`);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    return 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}

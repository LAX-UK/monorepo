/**
 * Map git paths to App Platform deploy components using workspace dependency closure.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

export const DEPLOY_COMPONENTS = [
  "api",
  "auth",
  "ws",
  "worker",
  "web",
  "migrate",
  "shop-identity",
  "shop-api",
  "shop-admin",
  "shop",
];

/** @type {Record<string, string>} */
export const COMPONENT_APP_ROOT = {
  api: "apps/api",
  auth: "apps/auth",
  ws: "apps/ws",
  worker: "apps/worker",
  web: "apps/web",
  shop: "apps/shop",
  "shop-api": "apps/shop-api",
  "shop-admin": "apps/shop-admin",
  "shop-identity": "apps/shop-identity",
  migrate: "packages/db",
};

/** Lockfile/workspace changes rebuild every deploy component. Root package.json alone does not. */
export const GLOBAL_PATH_PREFIXES = [
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  ".nvmrc",
];

/** Paths that must not trigger a staging deploy when they are the only changes. */
export const CI_ONLY_PATH_PREFIXES = [
  "docs/",
  ".github/workflows/ci.yml",
  ".github/workflows/identity-staging-acceptance.yml",
  ".github/workflows/shop-staging-acceptance.yml",
  ".github/workflows/test-platform-monitoring.yml",
  "scripts/ci/pipeline-stats.mjs",
  "scripts/ci/pipeline-stats.test.mjs",
  "scripts/ci/report-orphan-scripts.mjs",
];

export function isCiOnlyPath(path) {
  return CI_ONLY_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

const ROOT = process.cwd();

/** @type {Map<string, string> | null} */
let packageDirByName = null;

function loadPackageDirByName() {
  if (packageDirByName) return packageDirByName;
  packageDirByName = new Map();
  for (const scope of ["apps", "packages"]) {
    const base = join(ROOT, scope);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = join(base, entry.name);
      const pkgPath = join(dir, "package.json");
      if (!existsSync(pkgPath)) continue;
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (pkg.name) {
          packageDirByName.set(pkg.name, `${scope}/${entry.name}`);
        }
      } catch {
        /* ignore */
      }
    }
  }
  return packageDirByName;
}

function workspaceDeps(pkgJson) {
  const deps = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies,
    ...pkgJson.optionalDependencies,
  };
  return Object.entries(deps ?? {})
    .filter(([, v]) => typeof v === "string" && v.startsWith("workspace:"))
    .map(([name]) => name);
}

function collectWorkspaceClosure(packageJsonPath) {
  const dirs = new Set();
  const queue = [packageJsonPath];
  const seen = new Set();
  const nameToDir = loadPackageDirByName();
  while (queue.length) {
    const current = queue.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    const dir = join(current, "..");
    dirs.add(relative(ROOT, dir).replace(/\\/g, "/"));
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(current, "utf8"));
    } catch {
      continue;
    }
    for (const dep of workspaceDeps(pkg)) {
      const depDir = nameToDir.get(dep);
      if (depDir) {
        queue.push(join(ROOT, depDir, "package.json"));
      }
    }
  }
  return dirs;
}

/** @type {Record<string, string[]> | null} */
let pathPrefixesByComponent = null;

export function pathPrefixesForComponent(component) {
  if (!pathPrefixesByComponent) {
    pathPrefixesByComponent = {};
    for (const component of DEPLOY_COMPONENTS) {
      const prefixes = new Set();
      const appRoot = COMPONENT_APP_ROOT[component];
      if (appRoot) {
        prefixes.add(`${appRoot}/`);
        const pkgJson = join(ROOT, appRoot, "package.json");
        if (existsSync(pkgJson)) {
          for (const dir of collectWorkspaceClosure(pkgJson)) {
            prefixes.add(`${dir}/`);
            prefixes.add(dir);
          }
        }
      }
      if (component === "migrate") {
        prefixes.add("docker/migrate.Dockerfile");
        prefixes.add("packages/db/");
      }
      const dockerfile =
        component === "migrate" ? "docker/migrate.Dockerfile" : `${appRoot}/Dockerfile`;
      if (existsSync(join(ROOT, dockerfile))) {
        prefixes.add(dockerfile);
      }
      prefixes.add("patches/");
      pathPrefixesByComponent[component] = [...prefixes];
    }
  }
  return pathPrefixesByComponent[component] ?? [];
}

function pathMatchesPrefix(path, prefix) {
  if (prefix.endsWith("/")) return path.startsWith(prefix) || path === prefix.slice(0, -1);
  return path === prefix || path.startsWith(`${prefix}/`);
}

function packageDirForPath(path) {
  if (!path.startsWith("packages/")) return null;
  const rest = path.slice("packages/".length);
  const top = rest.split("/")[0];
  return top ? `packages/${top}` : null;
}

export function componentsForPath(path) {
  const hits = new Set();
  for (const component of DEPLOY_COMPONENTS) {
    for (const prefix of pathPrefixesForComponent(component)) {
      if (pathMatchesPrefix(path, prefix)) {
        hits.add(component);
        break;
      }
    }
  }
  return hits;
}

export function componentsForChangedPaths(changedPaths) {
  const deployPaths = changedPaths.filter((p) => !isCiOnlyPath(p));
  if (deployPaths.length === 0) {
    return [];
  }
  if (deployPaths.length === 1 && deployPaths[0] === "package.json") {
    return [];
  }
  if (deployPaths.some((p) => GLOBAL_PATH_PREFIXES.some((g) => p === g || p.startsWith(`${g}/`)))) {
    return [...DEPLOY_COMPONENTS];
  }
  const selected = new Set();
  for (const path of deployPaths) {
    if (path.startsWith("packages/")) {
      const pkgDir = packageDirForPath(path);
      const nameToDir = loadPackageDirByName();
      const known = pkgDir && [...nameToDir.values()].includes(pkgDir);
      if (!known) {
        return [...DEPLOY_COMPONENTS];
      }
    }
    for (const component of componentsForPath(path)) {
      selected.add(component);
    }
  }
  return [...selected];
}

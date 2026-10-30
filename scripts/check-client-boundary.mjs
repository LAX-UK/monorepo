#!/usr/bin/env node
/**
 * The client boundary of the shared UI entries. A value exported from a "use client" module is a
 * client reference when a server module imports it: a component or a hook is fine there, but
 * calling a function or reading a constant fails at render ("Attempted to call formatCount() from
 * the server"), or quietly reads the wrong value (a cookie name that is a reference, not a string).
 * LAX Admin's Overview broke this way twice (#685, then the LAX barrel after it).
 *
 * Two checks:
 * - strict entries (`@auction/ui/lax`) export only components and hooks from client modules, and
 *   the server-safe entry (`@auction/ui/lax/helpers`) reaches no client module at all;
 * - for every entry, no server module (one without "use client") imports a value that is neither
 *   a component nor a hook and comes from a client module. `@auction/staff-ui` still has such
 *   client-only values (toast and keyboard helpers): client code may use them, server code may not.
 * Re-exports are followed through plain modules, so a value cannot slip through one.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Entries other packages import. `strict`: no client-only values at all. `serverSafe`: no client
 * module at all.
 */
export const ENTRIES = [
  { specifier: "@auction/ui/lax", file: "packages/ui/src/lax/index.ts", strict: true },
  {
    specifier: "@auction/ui/lax/helpers",
    file: "packages/ui/src/lax/helpers.ts",
    strict: true,
    serverSafe: true,
  },
  { specifier: "@auction/staff-ui", file: "packages/staff-ui/src/index.ts", strict: false },
];

/** Where server modules live. */
const SOURCE_DIRS = ["apps", "packages"];

const USE_CLIENT = /^\s*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*["']use client["']/;

const isComponentOrHook = (name) => /^[A-Z][a-z]/.test(name) || /^use[A-Z]/.test(name);

function isClientModule(file) {
  return USE_CLIENT.test(readFileSync(file, "utf8"));
}

function resolveSource(from, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(from, specifier.replace(/\.js$/, ""));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** `a, type B, c as d` → [{ local: "a", exported: "a" }, { local: "c", exported: "d" }]. */
function valueNames(list) {
  return list
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith("type "))
    .map((part) => {
      const [local, exported = local] = part.split(/\s+as\s+/).map((s) => s.trim());
      return { local, exported };
    });
}

/**
 * Where each value an entry exports really comes from, following `export { … } from` through
 * plain modules. A client module ends the walk: the value is a client reference from there on.
 */
function exportOrigins(file, names = null, seen = new Set()) {
  const key = `${file}:${names ? [...names].join(",") : "*"}`;
  if (seen.has(key)) return [];
  seen.add(key);
  const source = readFileSync(file, "utf8");
  const origins = [];
  for (const match of source.matchAll(/export\s*(type\s*)?\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
    const [, typeOnly, list, specifier] = match;
    if (typeOnly) continue;
    const target = resolveSource(dirname(file), specifier);
    if (!target) continue;
    for (const { local, exported } of valueNames(list)) {
      if (names && !names.has(exported)) continue;
      if (isClientModule(target)) {
        origins.push({ name: exported, clientModule: target });
      } else {
        for (const inner of exportOrigins(target, new Set([local]), seen)) {
          origins.push({ ...inner, name: exported });
        }
      }
    }
  }
  return origins;
}

/** The values an entry exports from client modules that server code may not use. */
export function clientOnlyExports(entryFile, { serverSafe = false } = {}) {
  return exportOrigins(entryFile).filter(({ name }) => serverSafe || !isComponentOrHook(name));
}

/** One line per export that breaks a strict entry; empty when the entry is safe. */
export function clientBoundaryViolations(entryFile, { serverSafe = false } = {}) {
  return clientOnlyExports(entryFile, { serverSafe }).map(
    ({ name, clientModule }) =>
      `${relative(ROOT, entryFile)}: ${name} comes from the client module ${relative(ROOT, clientModule)}`,
  );
}

/** Server modules that import a client-only value from an entry, one line each. */
/**
 * Server modules that pass a child element to the shared Button with `asChild`. A link built on
 * the server can reach the button's Slot as a deferred reference, and the Slot then renders
 * nothing; `ButtonLink` / `StaffButtonLink` build the link on the client instead.
 */
export function serverAsChildViolations(files) {
  const lines = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (USE_CLIENT.test(source)) continue;
    if (!/from\s+"@auction\/(ui\/lax|staff-ui)"|from\s+"\.\.\/primitives\/button\.js"/.test(source))
      continue;
    for (const match of source.matchAll(/<(Button|StaffButton)\b[^>]*?\basChild\b/g)) {
      lines.push(
        `${relative(ROOT, file)}: <${match[1]} asChild> in a server module; use ${match[1]}Link with href`,
      );
    }
  }
  return lines;
}

export function serverImportViolations(files, clientOnlyBySpecifier) {
  const lines = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (USE_CLIENT.test(source)) continue;
    for (const match of source.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
      const [, typeOnly, list, specifier] = match;
      const clientOnly = clientOnlyBySpecifier.get(specifier);
      if (typeOnly || !clientOnly) continue;
      for (const { local } of valueNames(list)) {
        if (clientOnly.has(local)) {
          lines.push(
            `${relative(ROOT, file)}: imports ${local} from ${specifier}, a client-only value`,
          );
        }
      }
    }
  }
  return lines;
}

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".next"].includes(entry.name) || entry.name.startsWith(".")) {
      continue;
    }
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|spec|stories)\.|\.d\.ts$/.test(entry.name)
    ) {
      yield path;
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const entryViolations = ENTRIES.filter(({ strict }) => strict).flatMap(({ file, serverSafe }) =>
    clientBoundaryViolations(resolve(ROOT, file), { serverSafe }),
  );
  const clientOnlyBySpecifier = new Map(
    ENTRIES.map(({ specifier, file, serverSafe }) => [
      specifier,
      new Set(clientOnlyExports(resolve(ROOT, file), { serverSafe }).map(({ name }) => name)),
    ]),
  );
  const files = SOURCE_DIRS.flatMap((dir) => [...sourceFiles(resolve(ROOT, dir))]);
  const violations = [
    ...entryViolations,
    ...serverImportViolations(files, clientOnlyBySpecifier),
    ...serverAsChildViolations(files),
  ];
  if (violations.length > 0) {
    console.error("check-client-boundary: values from client modules reach server code\n");
    for (const line of violations) console.error(`  ${line}`);
    console.error(
      '\nMove each into a plain module (no "use client") and export it from there; server code imports plain LAX values from @auction/ui/lax/helpers.',
    );
    process.exit(1);
  }
  console.log(`check-client-boundary: ok (${ENTRIES.length} entries, ${files.length} modules)`);
}

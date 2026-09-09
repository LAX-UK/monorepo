#!/usr/bin/env node
/**
 * Verifies manifests and source imports for every package in the extractable
 * Identity closure. Literal dynamic imports are checked like static imports;
 * non-literal dynamic imports fail closed because their package boundary cannot
 * be established statically.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { IDENTITY_PACKAGES, IDENTITY_PACKAGE_NAMES } from "../identity/closure.mjs";
import { listSourceFiles, readImportSpecifiers } from "../identity/import-specifiers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(__dirname, "../..");
const allowedAuctionPackages = new Set(IDENTITY_PACKAGE_NAMES);
const manifestFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

function isAllowedAuthLibraryImport(relativePath, specifier) {
  if (/^@auction\/identity-contracts(?:\/|$)/.test(specifier)) return true;
  return (
    relativePath === "packages/auth/src/ports/consent-store.ts" &&
    /^@auction\/identity-db(?:\/|$)/.test(specifier)
  );
}

function isAllowedAuthAppImport(relativePath, specifier) {
  if (/^@auction\/(?:auth|identity-contracts|observability)(?:\/|$)/.test(specifier)) {
    return true;
  }
  return (
    (relativePath === "apps/auth/src/index.ts" ||
      /^apps\/auth\/src\/(?:container|infrastructure)\//.test(relativePath)) &&
    /^@auction\/identity-db(?:\/|$)/.test(specifier)
  );
}

export function identityExtractabilityViolations(root) {
  const violations = [];

  for (const expected of IDENTITY_PACKAGES) {
    const manifestPath = join(root, expected.path, "package.json");
    if (!existsSync(manifestPath)) {
      violations.push(`missing ${expected.path}/package.json`);
      continue;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.name !== expected.name) {
      violations.push(
        `${expected.path} has package name ${manifest.name}, expected ${expected.name}`,
      );
    }
    for (const field of manifestFields) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        if (dependency.startsWith("@auction/") && !allowedAuctionPackages.has(dependency)) {
          violations.push(`${expected.name} ${field} includes forbidden ${dependency}`);
        }
      }
    }

    const packageRoot = join(root, expected.path);
    for (const file of listSourceFiles(packageRoot)) {
      const relativePath = relative(root, file).replaceAll("\\", "/");
      for (const imported of readImportSpecifiers(file)) {
        if (imported.unresolved) {
          violations.push(
            `${relativePath} uses non-literal dynamic import(${imported.expression})`,
          );
          continue;
        }
        const specifier = imported.specifier;
        if (!specifier?.startsWith("@auction/")) {
          if (expected.name === "@auction/auth" && /^drizzle-orm(?:\/|$)/.test(specifier ?? "")) {
            violations.push(`${relativePath} imports ${specifier}; use an Identity port`);
          }
          continue;
        }
        const packageName = specifier.split("/").slice(0, 2).join("/");
        if (!allowedAuctionPackages.has(packageName)) {
          violations.push(`${relativePath} imports out-of-closure package ${specifier}`);
        } else if (
          expected.name === "@auction/auth" &&
          !isAllowedAuthLibraryImport(relativePath, specifier)
        ) {
          violations.push(`${relativePath} imports disallowed auth-library package ${specifier}`);
        } else if (
          expected.name === "@auction/auth-app" &&
          !isAllowedAuthAppImport(relativePath, specifier)
        ) {
          violations.push(`${relativePath} imports disallowed auth-app package ${specifier}`);
        } else if (
          ["@auction/identity-contracts", "@auction/observability"].includes(expected.name)
        ) {
          violations.push(
            `${relativePath} imports ${specifier}; ${expected.name} must remain a leaf`,
          );
        }
      }
    }
  }

  return violations;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const rootArgument = process.argv.find((argument) => argument.startsWith("--root="));
  const root = resolve(rootArgument?.slice("--root=".length) ?? defaultRoot);
  const violations = identityExtractabilityViolations(root);
  if (violations.length > 0) {
    console.error("Identity extractability violations detected:\n");
    for (const violation of violations) console.error(`  ${violation}`);
    process.exit(1);
  }
  console.log(
    `verify-identity-extractability: ok (${IDENTITY_PACKAGES.length} closure packages checked)`,
  );
}

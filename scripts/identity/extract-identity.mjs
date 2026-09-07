#!/usr/bin/env node
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapIdentityWorkspace } from "./bootstrap.mjs";
import { extractIdentityHistory } from "./extract-history.mjs";
import { verifyDockerClosure } from "./verify-docker-closure.mjs";
import { verifyExtractedIdentity } from "./verify-extracted.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const defaultSourceRoot = resolve(scriptRoot, "../..");

export function extractIdentityRepository({
  sourceRoot = defaultSourceRoot,
  destination,
  includeWorkingTree = true,
  scanSecrets = true,
}) {
  const sourceViolations = verifyDockerClosure(sourceRoot);
  if (sourceViolations.length > 0) {
    throw new Error(`Source Identity closure drift:\n${sourceViolations.join("\n")}`);
  }
  extractIdentityHistory({ sourceRoot, destination, includeWorkingTree });
  bootstrapIdentityWorkspace(destination);
  verifyExtractedIdentity(destination, { scanSecrets });
  return destination;
}

function parseArguments(argv) {
  const options = new Set(argv.filter((argument) => argument.startsWith("--")));
  const positionals = argv.filter((argument) => !argument.startsWith("--"));
  return {
    sourceRoot: resolve(
      positionals[1] ?? process.env.IDENTITY_EXTRACTION_SOURCE ?? defaultSourceRoot,
    ),
    destination: resolve(
      positionals[0] ??
        process.env.IDENTITY_EXTRACTION_DESTINATION ??
        join(tmpdir(), "auction-identity-extracted"),
    ),
    includeWorkingTree: !options.has("--committed-only"),
    scanSecrets: !options.has("--skip-secret-scan"),
    dryRun: options.has("--dry-run"),
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  if (options.dryRun) {
    const commands = extractIdentityHistory({ ...options, dryRun: true });
    for (const command of commands) console.log(command);
    console.log("would bootstrap and verify the extracted Identity repository");
  } else {
    const destination = extractIdentityRepository(options);
    console.log(`Identity repository extracted to ${destination}`);
  }
}

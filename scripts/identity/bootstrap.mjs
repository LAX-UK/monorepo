import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { prepareIdentityWorkspace } from "../ci/prepare-identity-lockfile.mjs";
import { IDENTITY_PACKAGES } from "./closure.mjs";

export function assertIdentityPackageManifests(workspaceRoot) {
  const violations = [];
  for (const expected of IDENTITY_PACKAGES) {
    const manifestPath = join(workspaceRoot, expected.path, "package.json");
    if (!existsSync(manifestPath)) {
      violations.push(`missing ${expected.path}/package.json`);
      continue;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.name !== expected.name) {
      violations.push(
        `${expected.path} is ${manifest.name ?? "unnamed"}, expected ${expected.name}`,
      );
    }
  }
  if (violations.length > 0) {
    throw new Error(`Invalid Identity package closure:\n${violations.join("\n")}`);
  }
}

export function bootstrapIdentityWorkspace(workspaceRoot) {
  assertIdentityPackageManifests(workspaceRoot);
  prepareIdentityWorkspace(workspaceRoot);
}

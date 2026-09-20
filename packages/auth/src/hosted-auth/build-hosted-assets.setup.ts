import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export default function setup(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const result = spawnSync(process.execPath, [join(root, "scripts/build-hosted-assets.mjs")], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("failed to build hosted auth browser assets");
  }
}

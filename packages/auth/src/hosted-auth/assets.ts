import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HostedFaviconAssetName } from "./favicons.js";

const HOSTED_FAVICONS_DIR = "favicons";

function resolveHostedAssetPath(relativePath: string): { path: string; tried: string[] } {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "assets", relativePath),
    join(here, "../../dist/hosted-auth/assets", relativePath),
  ];
  const tried: string[] = [];
  for (const path of candidates) {
    tried.push(path);
    try {
      readFileSync(path);
      return { path, tried };
    } catch {
      // try the next emit location
    }
  }
  throw new Error(
    `hosted auth asset missing: ${relativePath}. Run packages/auth build. Tried: ${tried.join(", ")}`,
  );
}

export function readHostedAsset(name: string): string {
  const { path } = resolveHostedAssetPath(name);
  return readFileSync(path, "utf8");
}

export function readHostedAssetBytes(name: string): Buffer {
  const { path } = resolveHostedAssetPath(name);
  return readFileSync(path);
}

export function readHostedFaviconBytes(name: HostedFaviconAssetName): Buffer {
  return readHostedAssetBytes(join(HOSTED_FAVICONS_DIR, name));
}

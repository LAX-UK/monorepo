import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LaxFaviconAssetName } from "@auction/branding";

export const HOSTED_SHOP_LOGO_FILENAME = "lax-shop-logo.svg";
export const HOSTED_BID_LOGO_FILENAME = "lax-bid-logo.svg";
export const HOSTED_BID_LOGO_LIGHT_FILENAME = "lax-bid-logo-light.svg";

const HOSTED_FAVICONS_DIR = "favicons";

export function hostedShopLogoPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "assets", HOSTED_SHOP_LOGO_FILENAME);
}

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

export function readHostedFaviconBytes(name: LaxFaviconAssetName): Buffer {
  const { path } = resolveHostedAssetPath(join(HOSTED_FAVICONS_DIR, name));
  return readFileSync(path);
}

export function readHostedShopLogoSvg(): string {
  return readHostedAsset(HOSTED_SHOP_LOGO_FILENAME);
}

export function readHostedBidLogoSvg(): string {
  return readHostedAsset(HOSTED_BID_LOGO_FILENAME);
}

export function readHostedBidLogoLightSvg(): string {
  return readHostedAsset(HOSTED_BID_LOGO_LIGHT_FILENAME);
}

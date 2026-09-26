import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HOSTED_SHOP_LOGO_FILENAME = "lax-shop-logo.svg";
export const HOSTED_BID_LOGO_FILENAME = "lax-bid-logo.svg";

export function hostedShopLogoPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "assets", HOSTED_SHOP_LOGO_FILENAME);
}

export function readHostedAsset(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "assets", name),
    join(here, "../../dist/hosted-auth/assets", name),
  ];
  const tried: string[] = [];
  for (const path of candidates) {
    tried.push(path);
    try {
      return readFileSync(path, "utf8");
    } catch {
      // try the next emit location
    }
  }
  throw new Error(
    `hosted auth asset missing: ${name}. Run packages/auth build:hosted-assets. Tried: ${tried.join(", ")}`,
  );
}

export function readHostedShopLogoSvg(): string {
  return readHostedAsset(HOSTED_SHOP_LOGO_FILENAME);
}

export function readHostedBidLogoSvg(): string {
  return readHostedAsset(HOSTED_BID_LOGO_FILENAME);
}

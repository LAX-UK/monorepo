import { loadShopEnv } from "@/env";
import { shopIdentityBaseUrl } from "@/lib/shop-identity.server";
import { SHOP_SILENT_SSO_COOKIE_PREFIX, isShopSilentSsoEnabled } from "@/lib/silent-sign-in/config";
import {
  createSilentSignInCookieSpec,
  evaluateSilentSignInCookieGate,
} from "@auction/identity-rp/silent-sign-in";
import type { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";

export type ShopSilentFedcmBootstrapProps = {
  configUrl: string;
  clientId: string;
  identityBaseUrl: string;
};

export function resolveShopSilentFedcmBootstrapProps(
  cookieList: RequestCookie[],
  signedIn: boolean,
  env: NodeJS.ProcessEnv = process.env,
): ShopSilentFedcmBootstrapProps | null {
  if (!isShopSilentSsoEnabled(env) || env.FEDCM_ENABLED !== "true") {
    return null;
  }
  if (signedIn) {
    return null;
  }
  const jar = {
    get: (name: string) => cookieList.find((c) => c.name === name)?.value,
    set: () => {
      throw new Error("read-only");
    },
    delete: () => {
      throw new Error("read-only");
    },
  };
  const gate = evaluateSilentSignInCookieGate({
    hasProductSession: false,
    cookieJar: jar,
    cookieNames: createSilentSignInCookieSpec(SHOP_SILENT_SSO_COOKIE_PREFIX),
  });
  if (!gate.allowed) {
    return null;
  }
  const shopEnv = loadShopEnv(env);
  const issuer = (
    shopEnv.IDENTITY_PUBLIC_BASE_URL ??
    shopEnv.WEB_ORIGIN ??
    "http://localhost:3003"
  ).replace(/\/+$/, "");
  return {
    configUrl: `${issuer}/fedcm/config.json`,
    clientId: "lax-shop-web",
    identityBaseUrl: shopIdentityBaseUrl(),
  };
}

import type { HostedBrandProfile } from "./brand.js";
import { selectHostedBrand } from "./brand.js";
import type { HostedAuthFlow } from "./flow-context.js";
import { parseHostedAuthFlow, productHintHref } from "./flow-context.js";

export type HostedAuthCapabilities = {
  googleEnabled: boolean;
  appleEnabled: boolean;
  phoneEnabled: boolean;
  turnstileSiteKey: string | null;
  shopOrigin: string;
  bidOrigin: string;
  emailFirst: boolean;
  requireEmailVerification: boolean;
};

export type HostedAuthPageConfig = {
  authorizeResumePath: string | null;
  loginPath: string;
  twoFactorPath: string;
  restartUrl: string;
  allowedRedirectOrigins: string[];
  turnstileSiteKey: string | null;
  requireEmailVerification: boolean;
};

export type HostedAuthView = {
  flow: HostedAuthFlow;
  brand: HostedBrandProfile;
  config: HostedAuthPageConfig;
  capabilities: HostedAuthCapabilities;
};

function trimOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

export function buildHostedAuthPageConfig(
  flow: HostedAuthFlow,
  capabilities: HostedAuthCapabilities,
): HostedAuthPageConfig {
  const restartUrl =
    flow.product === "shop"
      ? `${trimOrigin(capabilities.shopOrigin)}/login`
      : flow.product === "bid"
        ? `${trimOrigin(capabilities.bidOrigin)}/login`
        : "/login";
  return {
    authorizeResumePath: flow.authorizeResumePath,
    loginPath: flow.loginPath,
    twoFactorPath: productHintHref("/two-factor", flow),
    restartUrl,
    allowedRedirectOrigins: flow.allowedRedirectOrigins,
    turnstileSiteKey: capabilities.turnstileSiteKey,
    requireEmailVerification: capabilities.requireEmailVerification,
  };
}

export function createHostedAuthView(
  searchParams: URLSearchParams,
  capabilities: HostedAuthCapabilities,
): HostedAuthView {
  const flow = parseHostedAuthFlow(searchParams);
  return {
    flow,
    brand: selectHostedBrand(flow.clientId),
    config: buildHostedAuthPageConfig(flow, capabilities),
    capabilities,
  };
}

export const EMPTY_HOSTED_AUTH_CAPABILITIES: HostedAuthCapabilities = {
  googleEnabled: false,
  appleEnabled: false,
  phoneEnabled: false,
  turnstileSiteKey: null,
  shopOrigin: "http://localhost:3020",
  bidOrigin: "http://localhost:3000",
  emailFirst: true,
  requireEmailVerification: true,
};

export function hostedAuthViewFromSearch(
  search: string | URLSearchParams | undefined,
  capabilities: HostedAuthCapabilities = EMPTY_HOSTED_AUTH_CAPABILITIES,
): HostedAuthView {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  return createHostedAuthView(params, capabilities);
}

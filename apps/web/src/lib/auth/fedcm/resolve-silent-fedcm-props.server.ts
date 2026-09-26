import "server-only";
import {
  BID_SILENT_SSO_COOKIE_PREFIX,
  isBidSilentSsoEnabled,
} from "@/lib/auth/silent-sign-in/config";
import { bffConfig } from "@/lib/bff/config.server";
import {
  createSilentSignInCookieSpec,
  evaluateSilentSignInCookieGate,
} from "@auction/identity-rp/silent-sign-in";
export type SilentFedcmBootstrapProps = {
  configUrl: string;
  clientId: string;
};

export function resolveSilentFedcmBootstrapProps(
  cookies: { get(name: string): { value: string } | undefined },
  hasSession: boolean,
  env: NodeJS.ProcessEnv = process.env,
): SilentFedcmBootstrapProps | null {
  if (!isBidSilentSsoEnabled(env) || env.FEDCM_ENABLED !== "true") {
    return null;
  }
  if (hasSession) {
    return null;
  }
  const gate = evaluateSilentSignInCookieGate({
    hasProductSession: false,
    cookieJar: {
      get: (name) => cookies.get(name)?.value,
      set: () => {
        throw new Error("read-only");
      },
      delete: () => {
        throw new Error("read-only");
      },
    },
    cookieNames: createSilentSignInCookieSpec(BID_SILENT_SSO_COOKIE_PREFIX),
  });
  if (!gate.allowed) {
    return null;
  }
  const issuer = bffConfig().issuer.replace(/\/+$/, "");
  return {
    configUrl: `${issuer}/fedcm/config.json`,
    clientId: "lax-bid-web",
  };
}

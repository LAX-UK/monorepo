import { type TokenEndpoint, createFetchTokenEndpoint } from "@auction/identity-rp";
import type { LaxAccountConfig } from "../config";

/** Sign-in and refresh may wait on the issuer; a page that exchanges tokens passes a shorter limit. */
export function createAccountTokenEndpoint(
  config: LaxAccountConfig,
  timeoutMs = 15_000,
): TokenEndpoint {
  return createFetchTokenEndpoint({
    tokenEndpointUrl: `${config.oidcInternalIssuer}/api/auth/oauth2/token`,
    auth: {
      kind: "basic",
      clientId: config.oidcClientId,
      clientSecret: config.oidcClientSecret,
    },
    timeoutMs,
  });
}

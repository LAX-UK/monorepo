import { type TokenEndpoint, createFetchTokenEndpoint } from "@auction/identity-rp";
import type { LaxAccountConfig } from "../config";

export function createAccountTokenEndpoint(config: LaxAccountConfig): TokenEndpoint {
  return createFetchTokenEndpoint({
    tokenEndpointUrl: `${config.oidcInternalIssuer}/api/auth/oauth2/token`,
    auth: {
      kind: "basic",
      clientId: config.oidcClientId,
      clientSecret: config.oidcClientSecret,
    },
    timeoutMs: 15_000,
  });
}

import type { RegisteredOidcClientId } from "@auction/identity-contracts";
import type { ConfidentialClientAuthenticator } from "./token-exchange.routes.js";

export type ClientCredentials = { clientId: string; clientSecret: string };

export function parseClientCredentials(
  authorization: string | undefined,
  params: URLSearchParams,
): ClientCredentials | null {
  const postedClientId = params.get("client_id");
  const postedClientSecret = params.get("client_secret");
  if (authorization?.startsWith("Basic ")) {
    if (postedClientId || postedClientSecret) return null;
    try {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator < 1) return null;
      return {
        clientId: decodeURIComponent(decoded.slice(0, separator)),
        clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
      };
    } catch {
      return null;
    }
  }
  return postedClientId && postedClientSecret
    ? { clientId: postedClientId, clientSecret: postedClientSecret }
    : null;
}

export async function authenticateConfidentialClient(
  authenticator: ConfidentialClientAuthenticator,
  authorization: string | undefined,
  params: URLSearchParams,
): Promise<RegisteredOidcClientId | null> {
  const credentials = parseClientCredentials(authorization, params);
  return credentials
    ? authenticator.authenticate(credentials.clientId, credentials.clientSecret)
    : null;
}

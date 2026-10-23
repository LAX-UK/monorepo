import {
  ACCOUNT_SECURITY_FACTS_PATH,
  type AccountSecurityFactsResponse,
  accountSecurityFactsSchema,
} from "@auction/identity-contracts";
import type { LaxAccountConfig } from "../config";
import type { SecurityFactsReader } from "../ports/security-facts-reader";

const REQUEST_TIMEOUT_MS = 3_000;

/**
 * Asks the issuer, as LAX Account, for the facts of the person who owns `accessToken`. Any
 * failure (network, timeout, refusal, unexpected body) is reported as null so callers fall back
 * to what the ID token proves instead of guessing. The access token is sent in the request
 * body, never a URL, and nothing here logs it.
 */
export function createIssuerSecurityFactsReader(
  config: Pick<LaxAccountConfig, "oidcInternalIssuer" | "oidcClientId" | "oidcClientSecret">,
  fetchImpl: typeof fetch = fetch,
): SecurityFactsReader {
  const url = `${config.oidcInternalIssuer}/api/auth${ACCOUNT_SECURITY_FACTS_PATH}`;
  const basic = Buffer.from(
    `${encodeURIComponent(config.oidcClientId)}:${encodeURIComponent(config.oidcClientSecret)}`,
  ).toString("base64");
  return {
    async read(accessToken: string): Promise<AccountSecurityFactsResponse | null> {
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({ token: accessToken }),
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
          console.warn("account_security_facts_unavailable", { status: response.status });
          return null;
        }
        const parsed = accountSecurityFactsSchema.safeParse(await response.json());
        return parsed.success ? parsed.data : null;
      } catch (error) {
        console.warn("account_security_facts_unavailable", {
          reason: error instanceof Error ? error.name : "unknown",
        });
        return null;
      }
    },
  };
}

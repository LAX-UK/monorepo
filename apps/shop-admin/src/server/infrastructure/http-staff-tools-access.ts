import { LAX_RESOURCES } from "@auction/identity-contracts";
import type { TokenEndpoint } from "@auction/identity-rp";
import type { StaffToolId, StaffToolsAccess, StaffToolsAnswer } from "../ports/staff-tools-access";

const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

/** The only scope LAX Admin asks Bid for: it opens the staff tools route and nothing else. */
export const STAFF_TOOLS_READ_SCOPE = "lax.staff.tools.read";

const KNOWN_TOOLS: readonly StaffToolId[] = ["bid-admin", "lax-admin"];
const UNAVAILABLE: StaffToolsAnswer = { status: "unavailable" };

export type HttpStaffToolsAccessOptions = {
  /** Bid API's internal base URL; unset leaves the call unconfigured. */
  baseUrl: string | undefined;
  tokenEndpoint: TokenEndpoint;
  /** Covers the token exchange and the Bid call together. */
  timeoutMs: number;
  fetch?: typeof globalThis.fetch;
};

function readTools(payload: unknown): StaffToolId[] | null {
  if (!payload || typeof payload !== "object" || !("data" in payload)) return null;
  const data = payload.data;
  if (!data || typeof data !== "object" || !("tools" in data) || !Array.isArray(data.tools)) {
    return null;
  }
  const listed: unknown[] = data.tools;
  return KNOWN_TOOLS.filter((tool) => listed.includes(tool));
}

/**
 * Asks the Bid API which staff tools the signed-in person can open, as that person: the session's
 * ID token is exchanged (RFC 8693) for a token bound to the Bid API with the read-only
 * `lax.staff.tools.read` scope, and the Bid API answers only about the token's subject. Any
 * failure, whether unconfigured, refused, slow or malformed, answers "unavailable" rather than
 * throwing, so a Bid outage can never break a LAX Admin page.
 */
export function createHttpStaffToolsAccess(options: HttpStaffToolsAccessOptions): StaffToolsAccess {
  const doFetch = options.fetch ?? globalThis.fetch;
  return {
    async toolsFor({ idToken }) {
      if (!options.baseUrl) return UNAVAILABLE;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const issued = await Promise.race([
          options.tokenEndpoint.requestToken(
            new URLSearchParams({
              grant_type: TOKEN_EXCHANGE_GRANT,
              subject_token: idToken,
              subject_token_type: ID_TOKEN_TYPE,
              requested_token_type: ACCESS_TOKEN_TYPE,
              resource: LAX_RESOURCES["lax-bid-api"].uri,
              scope: STAFF_TOOLS_READ_SCOPE,
            }),
          ),
          new Promise<never>((_resolve, reject) => {
            controller.signal.addEventListener("abort", () => reject(new Error("timeout")));
          }),
        ]);
        if (!issued.access_token) return UNAVAILABLE;
        const response = await doFetch(`${options.baseUrl}/admin/staff/my-tools`, {
          method: "GET",
          headers: { authorization: `Bearer ${issued.access_token}` },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) return UNAVAILABLE;
        const tools = readTools(await response.json().catch(() => null));
        return tools ? { status: "ok", tools } : UNAVAILABLE;
      } catch {
        return UNAVAILABLE;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

import { IdentityUnavailableError } from "./errors.js";

export type OidcTokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type: string;
};

export function parseBearerTokenResponse(
  _status: number,
  json: Partial<OidcTokenResponse>,
): OidcTokenResponse {
  if (typeof json.access_token !== "string" || json.token_type?.toLowerCase() !== "bearer") {
    throw new IdentityUnavailableError("Identity token endpoint returned an invalid response");
  }
  return json as OidcTokenResponse;
}

/** Bid tolerates a missing refresh_token in refresh responses; Shop requires both tokens. */
export function mergeRefreshTokens(
  previous: { refreshToken: string; idToken: string },
  next: OidcTokenResponse,
  mode: "bid" | "shop",
): { refreshToken: string; idToken: string } {
  const refreshToken = next.refresh_token ?? previous.refreshToken;
  const idToken = next.id_token ?? previous.idToken;
  if (mode === "shop" && (!next.refresh_token || !next.id_token)) {
    throw new Error("OIDC refresh response missing required tokens");
  }
  return { refreshToken, idToken };
}

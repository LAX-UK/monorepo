import type { OidcTokenResponse } from "../token-codec.js";

export interface TokenEndpoint {
  requestToken(body: URLSearchParams): Promise<OidcTokenResponse>;
}

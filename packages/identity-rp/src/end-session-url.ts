import { randomBytes } from "node:crypto";

export function buildEndSessionUrl(input: {
  endSessionEndpoint: string;
  clientId: string;
  postLogoutRedirectUri: string;
  idTokenHint?: string | null;
  state?: string;
}): string {
  const url = new URL(input.endSessionEndpoint);
  url.searchParams.set("client_id", input.clientId);
  if (input.idTokenHint) url.searchParams.set("id_token_hint", input.idTokenHint);
  url.searchParams.set("post_logout_redirect_uri", input.postLogoutRedirectUri);
  url.searchParams.set("state", input.state ?? randomBytes(24).toString("base64url"));
  return url.toString();
}

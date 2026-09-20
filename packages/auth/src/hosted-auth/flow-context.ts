import {
  REGISTERED_OIDC_CLIENTS,
  REGISTERED_OIDC_CLIENT_IDS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";

const AUTHORIZE_PATH = "/api/auth/oauth2/authorize";

const ALLOWED_AUTHORIZE_PARAMS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "scope",
  "state",
  "nonce",
  "code_challenge",
  "code_challenge_method",
  "prompt",
  "max_age",
] as const;

export type HostedAuthProduct = "shop" | "bid" | "unknown";

export type HostedAuthFlow = {
  clientId: RegisteredOidcClientId | null;
  product: HostedAuthProduct;
  continuationQuery: string;
  authorizeResumePath: string | null;
  loginPath: string;
  allowedRedirectOrigins: string[];
};

function productForClient(clientId: RegisteredOidcClientId): HostedAuthProduct {
  if (clientId === REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB) return "shop";
  if (clientId === REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB) return "bid";
  return "unknown";
}

function uniqueOrigins(uris: readonly string[]): string[] {
  const origins = new Set<string>();
  for (const uri of uris) {
    try {
      origins.add(new URL(uri).origin);
    } catch {
      // skip malformed registry entries
    }
  }
  return [...origins];
}

function emptyFlow(): HostedAuthFlow {
  return {
    clientId: null,
    product: "unknown",
    continuationQuery: "",
    authorizeResumePath: null,
    loginPath: "/login",
    allowedRedirectOrigins: [],
  };
}

export function parseHostedAuthFlow(searchParams: URLSearchParams): HostedAuthFlow {
  const rawClientId = searchParams.get("client_id");
  if (!rawClientId || !(rawClientId in REGISTERED_OIDC_CLIENTS)) {
    return emptyFlow();
  }
  const clientId = rawClientId as RegisteredOidcClientId;
  const registered = REGISTERED_OIDC_CLIENTS[clientId];
  const product = productForClient(clientId);
  const allowedRedirectOrigins = uniqueOrigins(registered.redirectUris);

  const responseType = searchParams.get("response_type");
  const redirectUri = searchParams.get("redirect_uri");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = (searchParams.get("code_challenge_method") ?? "").toLowerCase();
  const state = searchParams.get("state");
  const redirectOk = Boolean(redirectUri && registered.redirectUris.includes(redirectUri));
  const pkceOk =
    !registered.pkceRequired || (Boolean(codeChallenge) && codeChallengeMethod === "s256");
  const canResume = responseType === "code" && redirectOk && pkceOk && Boolean(state);

  const continuation = new URLSearchParams();
  continuation.set("client_id", clientId);
  if (canResume) {
    for (const key of ALLOWED_AUTHORIZE_PARAMS) {
      const value = searchParams.get(key);
      if (value) continuation.set(key, value);
    }
  }

  const continuationQuery = continuation.toString();
  const productHintQuery = `client_id=${encodeURIComponent(clientId)}`;
  return {
    clientId,
    product,
    continuationQuery,
    authorizeResumePath: canResume ? `${AUTHORIZE_PATH}?${continuationQuery}` : null,
    loginPath: `/login?${productHintQuery}`,
    allowedRedirectOrigins,
  };
}

export function continuationHref(path: string, flow: HostedAuthFlow): string {
  if (!flow.continuationQuery) return path;
  return `${path}?${flow.continuationQuery}`;
}

/** Auxiliary hosted links may carry only the registered client hint. */
export function productHintHref(path: string, flow: HostedAuthFlow): string {
  if (!flow.clientId) return path;
  return `${path}?client_id=${encodeURIComponent(flow.clientId)}`;
}

import {
  REGISTERED_OIDC_CLIENTS,
  REGISTERED_OIDC_CLIENT_IDS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";

const AUTHORIZE_PATH = "/api/auth/oauth2/authorize";

export const ALLOWED_OIDC_AUTHORIZE_QUERY_PARAMS = [
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
  "acr_values",
] as const;

/** Copy OIDC authorize query params onto a hosted MFA/setup URL so authorize can resume. */
export function appendOidcAuthorizeParams(
  target: URL,
  source: URLSearchParams,
  options?: { ensureClientId?: string },
): void {
  if (options?.ensureClientId) {
    target.searchParams.set("client_id", options.ensureClientId);
  }
  for (const key of ALLOWED_OIDC_AUTHORIZE_QUERY_PARAMS) {
    const value = source.get(key);
    if (value) target.searchParams.set(key, value);
  }
}

export type HostedAuthProduct = "shop" | "bid" | "shop-admin" | "account" | "unknown";
export type HostedAuthAudience = "customer" | "staff";

export type HostedAuthFlow = {
  clientId: RegisteredOidcClientId | null;
  product: HostedAuthProduct;
  audience: HostedAuthAudience;
  continuationQuery: string;
  authorizeResumePath: string | null;
  loginPath: string;
  allowedRedirectOrigins: string[];
};

function productForClient(clientId: RegisteredOidcClientId): HostedAuthProduct {
  if (clientId === REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN) return "shop-admin";
  if (clientId === REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB) return "shop";
  if (clientId === REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB) return "bid";
  if (clientId === REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB) return "account";
  return "unknown";
}

function audienceForClient(clientId: RegisteredOidcClientId): HostedAuthAudience {
  if (clientId === REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN) return "staff";
  return "customer";
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
    audience: "customer",
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
    for (const key of ALLOWED_OIDC_AUTHORIZE_QUERY_PARAMS) {
      const value = searchParams.get(key);
      if (value) continuation.set(key, value);
    }
  }

  const continuationQuery = continuation.toString();
  const productHintQuery = `client_id=${encodeURIComponent(clientId)}`;
  return {
    clientId,
    product,
    audience: audienceForClient(clientId),
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

const HOSTED_CHROME_SIGN_UP = "sign-up";

function promptTokens(prompt: string | null): string[] {
  if (!prompt) return [];
  return prompt
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** True when OIDC Prompt Create 1.0 requests hosted sign-up chrome. */
export function hostedSignUpRequested(searchParams: URLSearchParams): boolean {
  if (searchParams.get("hosted_chrome") === HOSTED_CHROME_SIGN_UP) return true;
  return promptTokens(searchParams.get("prompt")).includes("create");
}

/**
 * Better Auth rejects unknown prompt values once a session exists. Strip `create`
 * before authorize handling and carry sign-up intent via `hosted_chrome`.
 */
export function normalizeAuthorizePromptForCreate(url: URL): URL | null {
  const prompt = url.searchParams.get("prompt");
  const tokens = promptTokens(prompt);
  if (!tokens.includes("create")) return null;
  const normalized = new URL(url.toString());
  const remaining = tokens.filter((token) => token !== "create");
  if (remaining.length === 0) normalized.searchParams.delete("prompt");
  else normalized.searchParams.set("prompt", remaining.join(" "));
  normalized.searchParams.set("hosted_chrome", HOSTED_CHROME_SIGN_UP);
  return normalized;
}

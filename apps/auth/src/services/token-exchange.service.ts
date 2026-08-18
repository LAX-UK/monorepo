import {
  ACCESS_TOKEN_TTL_SECONDS,
  type LaxResourceId,
  type ProductScope,
  REGISTERED_OIDC_CLIENTS,
  type RegisteredOidcClientId,
  findLaxResourceByUri,
} from "@auction/identity-contracts";

export const TOKEN_EXCHANGE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:token-exchange" as const;
export const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token" as const;
export const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token" as const;
export const JWT_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:jwt" as const;

export type TokenExchangeErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_scope"
  | "invalid_target"
  | "server_error";

export class TokenExchangeError extends Error {
  constructor(
    readonly code: TokenExchangeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TokenExchangeError";
  }
}

export type VerifiedSubjectToken = {
  subject: string;
  sid?: string;
};

export type TokenExchangePorts = {
  verifySubjectToken(input: {
    token: string;
    tokenType: typeof ACCESS_TOKEN_TYPE | typeof ID_TOKEN_TYPE | typeof JWT_TOKEN_TYPE;
    expectedAudience: RegisteredOidcClientId;
  }): Promise<VerifiedSubjectToken | null>;
  isSubjectActive(subject: string): Promise<boolean>;
  signAccessToken(input: {
    subject: string;
    sid?: string;
    audience: LaxResourceId;
    scopes: readonly ProductScope[];
  }): Promise<string>;
};

export type TokenExchangeResult = {
  access_token: string;
  issued_token_type: typeof ACCESS_TOKEN_TYPE;
  token_type: "Bearer";
  expires_in: typeof ACCESS_TOKEN_TTL_SECONDS;
  scope?: string;
};

export function resolveTokenExchangePolicy(input: {
  clientId: RegisteredOidcClientId;
  resource: string;
  scope?: string | undefined;
}): { audience: LaxResourceId; scopes: ProductScope[] } {
  const client = REGISTERED_OIDC_CLIENTS[input.clientId];
  const resource = findLaxResourceByUri(input.resource);
  if (!resource || !client.allowedResources.includes(resource.id)) {
    throw new TokenExchangeError("invalid_target", "The requested resource is not allowed");
  }

  const requested = (input.scope ?? "").split(/\s+/).filter(Boolean) as ProductScope[];
  if (new Set(requested).size !== requested.length) {
    throw new TokenExchangeError("invalid_scope", "The requested scope contains duplicates");
  }
  if (
    requested.some(
      (scope) => !resource.allowedScopes.includes(scope) || !client.allowedScopes.includes(scope),
    )
  ) {
    throw new TokenExchangeError("invalid_scope", "The requested scope is not allowed");
  }
  return { audience: resource.id, scopes: requested };
}

export class TokenExchangeService {
  constructor(private readonly ports: TokenExchangePorts) {}

  async exchange(input: {
    clientId: RegisteredOidcClientId;
    subjectToken: string;
    subjectTokenType: string;
    resource: string;
    scope?: string | undefined;
  }): Promise<TokenExchangeResult> {
    if (
      input.subjectTokenType !== ACCESS_TOKEN_TYPE &&
      input.subjectTokenType !== ID_TOKEN_TYPE &&
      input.subjectTokenType !== JWT_TOKEN_TYPE
    ) {
      throw new TokenExchangeError("invalid_request", "Unsupported subject_token_type");
    }

    const policy = resolveTokenExchangePolicy(input);
    const verified = await this.ports.verifySubjectToken({
      token: input.subjectToken,
      tokenType: input.subjectTokenType,
      expectedAudience: input.clientId,
    });
    if (!verified || !(await this.ports.isSubjectActive(verified.subject))) {
      throw new TokenExchangeError("invalid_request", "The subject token is invalid");
    }

    const accessToken = await this.ports.signAccessToken({
      subject: verified.subject,
      ...(verified.sid ? { sid: verified.sid } : {}),
      audience: policy.audience,
      scopes: policy.scopes,
    });
    return {
      access_token: accessToken,
      issued_token_type: ACCESS_TOKEN_TYPE,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      ...(policy.scopes.length > 0 ? { scope: policy.scopes.join(" ") } : {}),
    };
  }
}

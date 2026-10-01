import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { OIDC_ACR_BRONZE, OIDC_ACR_SILVER } from "@auction/identity-contracts";

const AUTHORIZATION_CODE_TTL_SEC = 10 * 60;
const OAUTH_SERVER_ERROR_DESCRIPTION = "Authorization request could not be completed";

export class OidcAuthorizationCodeCorrelationError extends Error {
  constructor() {
    super("OIDC authorization-code correlation is missing, invalid, or already consumed");
    this.name = "OidcAuthorizationCodeCorrelationError";
  }
}

export type OidcIdentitySessionEvidence = {
  id: string;
  subjectId: string;
  createdAt: Date;
  lastPasswordAuthAt: Date | null;
  mfaCompletedAt: Date | null;
  lastStepUpAt: Date | null;
};

export type OidcCodeCorrelationStore = {
  putIfAbsent(codeHash: string, identitySessionId: string, ttlSec: number): Promise<boolean>;
  consume(codeHash: string): Promise<string | null>;
};

export type OidcRpSessionRepository = {
  findIdentitySession(identitySessionId: string): Promise<OidcIdentitySessionEvidence | null>;
  upsertRpSession(input: {
    clientId: string;
    subjectId: string;
    sid: string;
    identitySessionId: string;
    seenAt: Date;
  }): Promise<void>;
};

type TokenRequestContext = { codeHash: string };

export function hashAuthorizationCode(code: string): string {
  return createHash("sha256").update(code).digest("base64url");
}

export async function readAuthorizationCode(request: Request): Promise<string | null> {
  if (request.method !== "POST") return null;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.clone().json()) as Record<string, unknown>;
      return body.grant_type === "authorization_code" && typeof body.code === "string"
        ? body.code
        : null;
    }
    const body = await request.clone().formData();
    return body.get("grant_type") === "authorization_code" && typeof body.get("code") === "string"
      ? (body.get("code") as string)
      : null;
  } catch {
    return null;
  }
}

export async function readAuthorizationCodeFromResponse(
  response: Response,
): Promise<string | null> {
  if (response.status < 200 || response.status >= 400) return null;
  const location = response.headers.get("location");
  if (location) return new URL(location).searchParams.get("code");
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return null;
  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    const redirect =
      typeof body.redirectURI === "string"
        ? body.redirectURI
        : typeof body.url === "string"
          ? body.url
          : null;
    return redirect ? new URL(redirect).searchParams.get("code") : null;
  } catch {
    return null;
  }
}

/**
 * Replaces an already validated Better Auth authorization redirect with an
 * OAuth server_error. It intentionally derives the target only from Better
 * Auth's response, never from an unvalidated request redirect_uri.
 */
export async function createAuthorizationServerErrorResponse(
  response: Response,
): Promise<Response> {
  const location = response.headers.get("location");
  if (location) {
    const redirect = new URL(location);
    redirect.searchParams.delete("code");
    redirect.searchParams.set("error", "server_error");
    redirect.searchParams.set("error_description", OAUTH_SERVER_ERROR_DESCRIPTION);
    const headers = new Headers(response.headers);
    headers.set("location", redirect.toString());
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.clone().json()) as Record<string, unknown>;
    const redirectKey =
      typeof body.redirectURI === "string"
        ? "redirectURI"
        : typeof body.url === "string"
          ? "url"
          : null;
    if (redirectKey) {
      const redirect = new URL(body[redirectKey] as string);
      redirect.searchParams.delete("code");
      redirect.searchParams.set("error", "server_error");
      redirect.searchParams.set("error_description", OAUTH_SERVER_ERROR_DESCRIPTION);
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      return Response.json(
        { ...body, [redirectKey]: redirect.toString() },
        { status: response.status, statusText: response.statusText, headers },
      );
    }
  }

  return Response.json(
    { error: "server_error", error_description: OAUTH_SERVER_ERROR_DESCRIPTION },
    { status: 500 },
  );
}

/**
 * Bridges Better Auth's authorization response to its supported
 * `getAdditionalUserInfoClaim` callback without retaining raw authorization codes.
 */
export class OidcSessionCoordinator {
  readonly #requestContext = new AsyncLocalStorage<TokenRequestContext>();

  constructor(
    private readonly correlations: OidcCodeCorrelationStore,
    private readonly sessions: OidcRpSessionRepository,
    private readonly recentStepUpMaxAgeSec: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async captureAuthorizationSession(response: Response, identitySessionId: string): Promise<void> {
    const code = await readAuthorizationCodeFromResponse(response);
    if (!code) return;
    const stored = await this.correlations.putIfAbsent(
      hashAuthorizationCode(code),
      identitySessionId,
      AUTHORIZATION_CODE_TTL_SEC,
    );
    if (!stored) throw new Error("OIDC authorization-code correlation collision");
  }

  async runTokenRequest<T>(code: string | null, operation: () => Promise<T>): Promise<T> {
    if (!code) return operation();
    return this.#requestContext.run({ codeHash: hashAuthorizationCode(code) }, operation);
  }

  async resolveIdTokenClaims(input: {
    subjectId: string;
    clientId: string;
  }): Promise<{ sid?: string; auth_time?: number; acr?: string; amr?: string[] }> {
    const requestContext = this.#requestContext.getStore();
    // The supported callback also serves /userinfo. Session claims belong only
    // to authorization-code id_token issuance.
    if (!requestContext) return {};

    const identitySessionId = await this.correlations.consume(requestContext.codeHash);
    if (!identitySessionId) throw new OidcAuthorizationCodeCorrelationError();
    const identitySession = await this.sessions.findIdentitySession(identitySessionId);
    if (!identitySession || identitySession.subjectId !== input.subjectId) {
      throw new OidcAuthorizationCodeCorrelationError();
    }

    const now = this.now();
    const passwordAt = identitySession.lastPasswordAuthAt;
    const stepUpAt = identitySession.lastStepUpAt;
    const isRecentStepUp =
      stepUpAt !== null && now.getTime() - stepUpAt.getTime() <= this.recentStepUpMaxAgeSec * 1_000;
    const isSilver = identitySession.mfaCompletedAt !== null || isRecentStepUp;
    const sid = identitySession.id;

    await this.sessions.upsertRpSession({
      clientId: input.clientId,
      subjectId: input.subjectId,
      sid,
      identitySessionId: identitySession.id,
      seenAt: now,
    });

    return {
      sid,
      auth_time: Math.floor(identitySession.createdAt.getTime() / 1_000),
      acr: isSilver ? OIDC_ACR_SILVER : OIDC_ACR_BRONZE,
      ...(identitySession.mfaCompletedAt
        ? { amr: ["pwd", "otp"] }
        : passwordAt
          ? { amr: ["pwd"] }
          : {}),
    };
  }
}

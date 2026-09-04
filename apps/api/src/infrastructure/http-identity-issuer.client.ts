import type {
  IIdentityCredentialClient,
  IIdentityEmailChangeClient,
  IIdentityIssuerClient,
  IIdentityProfileClient,
  IIdentitySecurityClient,
  IIdentitySessionClient,
  IIdentitySubjectClient,
  IdentityIssuerRequestContext,
  IdentityIssuerSignUpInput,
  IdentitySession,
  IdentitySubject,
} from "../services/interfaces/identity-issuer-client.js";

const DEFAULT_TIMEOUT_MS = 5_000;
const FORWARDED_HEADERS = [
  "cookie",
  "origin",
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
] as const;

export type IdentityIssuerClientErrorKind = "timeout" | "network" | "http" | "invalid_response";

export class IdentityIssuerClientError extends Error {
  constructor(
    readonly kind: IdentityIssuerClientErrorKind,
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "IdentityIssuerClientError";
  }
}

export class HttpIdentityIssuerClient
  implements
    IIdentityIssuerClient,
    IIdentitySubjectClient,
    IIdentityCredentialClient,
    IIdentitySessionClient,
    IIdentityEmailChangeClient,
    IIdentityProfileClient,
    IIdentitySecurityClient
{
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly defaultOrigin: string | undefined;
  private readonly machineClientId: string | undefined;
  private readonly machineClientSecret: string | undefined;
  private machineToken: { value: string; expiresAt: number } | null = null;

  constructor(input: {
    issuerBaseUrl: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    defaultOrigin?: string;
    machineClientId?: string;
    machineClientSecret?: string;
  }) {
    this.baseUrl = input.issuerBaseUrl.replace(/\/+$/, "");
    this.fetchImpl = input.fetchImpl ?? fetch;
    this.timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultOrigin = input.defaultOrigin;
    this.machineClientId = input.machineClientId;
    this.machineClientSecret = input.machineClientSecret;
  }

  async signUpEmail(input: IdentityIssuerSignUpInput): Promise<{ userId: string }> {
    const body = await this.post(
      "/api/auth/sign-up/email",
      {
        name: input.name,
        email: input.email,
        password: input.password,
        callbackURL: input.callbackURL,
      },
      input,
    );
    const userId = readUserId(body);
    if (!userId) {
      throw new IdentityIssuerClientError(
        "invalid_response",
        "Identity issuer returned an invalid sign-up response",
      );
    }
    return { userId };
  }

  async sendVerificationEmail(
    input: IdentityIssuerRequestContext & { email: string; callbackURL: string },
  ): Promise<void> {
    await this.post(
      "/api/auth/send-verification-email",
      { email: input.email, callbackURL: input.callbackURL },
      input,
    );
  }

  async requestPasswordReset(
    input: IdentityIssuerRequestContext & { email: string; redirectTo: string },
  ): Promise<void> {
    await this.post(
      "/api/auth/request-password-reset",
      { email: input.email, redirectTo: input.redirectTo },
      input,
    );
  }

  async requestMagicLink(
    input: IdentityIssuerRequestContext & {
      email: string;
      callbackURL: string;
      errorCallbackURL: string;
    },
  ): Promise<void> {
    await this.post(
      "/api/auth/sign-in/magic-link",
      {
        email: input.email,
        callbackURL: input.callbackURL,
        errorCallbackURL: input.errorCallbackURL,
      },
      input,
    );
  }

  async readSubject(subjectId: string): Promise<IdentitySubject | null> {
    try {
      const body = await this.machineRequest(
        "GET",
        `/identity/subjects/${encodeURIComponent(subjectId)}`,
      );
      return readSubject(body);
    } catch (error) {
      if (
        error instanceof IdentityIssuerClientError &&
        error.status === 404 &&
        error.code === "subject_not_found"
      ) {
        return null;
      }
      throw error;
    }
  }

  async findSubjectByEmail(email: string): Promise<IdentitySubject | null> {
    const body = await this.machineRequest("POST", "/identity/subjects/lookup", { email });
    if (!isRecord(body) || body.subject === null) return null;
    return readSubject(body);
  }

  async findByEmail(email: string): Promise<{ userId: string; emailVerified: boolean } | null> {
    const subject = await this.findSubjectByEmail(email);
    return subject ? { userId: subject.id, emailVerified: subject.emailVerified } : null;
  }

  async readSecurityStatus(subjectId: string) {
    try {
      const body = await this.machineRequest(
        "GET",
        `/identity/subjects/${encodeURIComponent(subjectId)}/security-status`,
      );
      if (!isRecord(body) || !isRecord(body.status)) throw invalidResponse("security status");
      const status = body.status;
      if (
        typeof status.twoFactorEnabled !== "boolean" ||
        (status.phoneNumber !== null && typeof status.phoneNumber !== "string") ||
        typeof status.phoneNumberVerified !== "boolean" ||
        (status.pendingNewEmail !== null && typeof status.pendingNewEmail !== "string")
      ) {
        throw invalidResponse("security status");
      }
      return {
        twoFactorEnabled: status.twoFactorEnabled,
        phoneNumber: status.phoneNumber,
        phoneNumberVerified: status.phoneNumberVerified,
        pendingNewEmail: status.pendingNewEmail,
        emailChangeExpiresAt: readNullableDate(
          status.emailChangeExpiresAt,
          "securityStatus.emailChangeExpiresAt",
        ),
      };
    } catch (error) {
      if (
        error instanceof IdentityIssuerClientError &&
        error.status === 404 &&
        error.code === "subject_not_found"
      ) {
        return null;
      }
      throw error;
    }
  }

  async credentialSummary(
    subjectId: string,
  ): Promise<{ hasPassword: boolean; linkedProviders: string[] }> {
    const body = await this.machineRequest(
      "GET",
      `/identity/subjects/${encodeURIComponent(subjectId)}/credentials`,
    );
    if (
      !isRecord(body) ||
      typeof body.hasPassword !== "boolean" ||
      !Array.isArray(body.linkedProviders) ||
      !body.linkedProviders.every((item) => typeof item === "string")
    ) {
      throw invalidResponse("credential summary");
    }
    return { hasPassword: body.hasPassword, linkedProviders: body.linkedProviders };
  }

  async hasCredentialAccount(subjectId: string): Promise<boolean> {
    return (await this.credentialSummary(subjectId)).hasPassword;
  }

  async hasLinkedProvider(subjectId: string, provider: "google" | "apple"): Promise<boolean> {
    return (await this.credentialSummary(subjectId)).linkedProviders.includes(provider);
  }

  async getRecentSessions(subjectId: string, limit: number) {
    const sessions = await this.listSessions(subjectId);
    return sessions.slice(0, Math.min(100, Math.max(1, limit))).map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
    }));
  }

  async setupPassword(input: {
    subjectId: string;
    password: string;
    sessionToken?: string;
  }): Promise<void> {
    await this.machineRequest(
      "POST",
      `/identity/subjects/${encodeURIComponent(input.subjectId)}/credentials/password`,
      {
        password: input.password,
        ...(input.sessionToken ? { sessionToken: input.sessionToken } : {}),
      },
    );
  }

  async stepUpStatus(input: {
    subjectId: string;
    sessionToken: string;
  }): Promise<{ hasCredential: boolean; lastPasswordAuthAt: Date | null }> {
    const body = await this.machineRequest(
      "POST",
      `/identity/subjects/${encodeURIComponent(input.subjectId)}/step-up/status`,
      { sessionToken: input.sessionToken },
    );
    if (!isRecord(body) || typeof body.hasCredential !== "boolean") {
      throw invalidResponse("step-up status");
    }
    return {
      hasCredential: body.hasCredential,
      lastPasswordAuthAt: readNullableDate(body.lastPasswordAuthAt, "lastPasswordAuthAt"),
    };
  }

  async verifyPasswordAndStamp(input: {
    subjectId: string;
    password: string;
    sessionToken: string;
  }): Promise<void> {
    await this.machineRequest(
      "POST",
      `/identity/subjects/${encodeURIComponent(input.subjectId)}/step-up/verify-password`,
      { password: input.password, sessionToken: input.sessionToken },
    );
  }

  async changePassword(input: {
    subjectId: string;
    currentPassword: string;
    newPassword: string;
    sessionToken: string;
  }): Promise<void> {
    await this.machineRequest(
      "POST",
      `/identity/subjects/${encodeURIComponent(input.subjectId)}/credentials/change-password`,
      {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        sessionToken: input.sessionToken,
      },
    );
  }

  async listSessions(subjectId: string, currentSessionToken?: string): Promise<IdentitySession[]> {
    const body = await this.machineRequest(
      "POST",
      `/identity/subjects/${encodeURIComponent(subjectId)}/sessions/list`,
      currentSessionToken ? { currentSessionToken } : {},
    );
    if (!isRecord(body) || !Array.isArray(body.sessions)) {
      throw invalidResponse("session list");
    }
    return body.sessions.map(readSession);
  }

  async revokeSession(subjectId: string, sessionId: string): Promise<boolean> {
    const body = await this.machineRequest(
      "POST",
      `/identity/subjects/${encodeURIComponent(subjectId)}/sessions/revoke`,
      { sessionId },
    );
    if (!isRecord(body) || typeof body.revoked !== "boolean") {
      throw invalidResponse("session revocation");
    }
    return body.revoked;
  }

  async revokeAllSessions(subjectId: string, exceptSessionToken?: string): Promise<number> {
    const body = await this.machineRequest(
      "POST",
      `/identity/subjects/${encodeURIComponent(subjectId)}/sessions/revoke-all`,
      exceptSessionToken ? { exceptSessionToken } : {},
    );
    if (!isRecord(body) || typeof body.revoked !== "number") {
      throw invalidResponse("session revocation");
    }
    return body.revoked;
  }

  async startEmailChange(input: {
    subjectId: string;
    newEmail: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.machineRequest(
      "POST",
      `/identity/subjects/${encodeURIComponent(input.subjectId)}/email-change/start`,
      { newEmail: input.newEmail, expiresAt: input.expiresAt.toISOString() },
    );
  }

  async pendingEmailChange(subjectId: string): Promise<string | null> {
    const body = await this.machineRequest(
      "GET",
      `/identity/subjects/${encodeURIComponent(subjectId)}/email-change`,
    );
    if (
      !isRecord(body) ||
      (body.pendingNewEmail !== null && typeof body.pendingNewEmail !== "string")
    ) {
      throw invalidResponse("pending email change");
    }
    return body.pendingNewEmail;
  }

  async cancelEmailChange(subjectId: string): Promise<void> {
    await this.machineRequest(
      "POST",
      `/identity/subjects/${encodeURIComponent(subjectId)}/email-change/cancel`,
      {},
    );
  }

  async confirmEmailChange(input: {
    subjectId: string;
    oldEmail: string;
    newEmail: string;
    confirmFor: "old" | "new";
  }): Promise<boolean> {
    const body = await this.machineRequest(
      "POST",
      `/identity/subjects/${encodeURIComponent(input.subjectId)}/email-change/confirm`,
      input,
    );
    if (!isRecord(body) || typeof body.completed !== "boolean") {
      throw invalidResponse("email change confirmation");
    }
    return body.completed;
  }

  async deleteOrphanSubject(subjectId: string): Promise<boolean> {
    const body = await this.machineRequest(
      "DELETE",
      `/identity/subjects/${encodeURIComponent(subjectId)}/orphan`,
    );
    if (!isRecord(body) || typeof body.deleted !== "boolean") {
      throw invalidResponse("orphan subject deletion");
    }
    return body.deleted;
  }

  async updateSubjectProfile(
    subjectId: string,
    patch: { name?: string; image?: string | null },
  ): Promise<void> {
    await this.machineRequest(
      "PATCH",
      `/identity/subjects/${encodeURIComponent(subjectId)}/profile`,
      patch,
    );
  }

  async markDeletionRequested(subjectId: string): Promise<void> {
    await this.machineRequest(
      "POST",
      `/identity/subjects/${encodeURIComponent(subjectId)}/deletion-request`,
      {},
    );
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
    context: IdentityIssuerRequestContext,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: forwardHeaders(context.headers, this.defaultOrigin),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const responseBody = await readResponseBody(response);
      if (!response.ok) {
        const details = readErrorDetails(responseBody);
        throw new IdentityIssuerClientError(
          "http",
          details.message ?? `Identity issuer request failed with status ${response.status}`,
          response.status,
          details.code,
        );
      }
      return responseBody;
    } catch (error) {
      if (error instanceof IdentityIssuerClientError) throw error;
      if (controller.signal.aborted) {
        throw new IdentityIssuerClientError("timeout", "Identity issuer request timed out");
      }
      throw new IdentityIssuerClientError(
        "network",
        error instanceof Error ? error.message : "Identity issuer request failed",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async machineRequest(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
    retry = true,
  ): Promise<unknown> {
    const token = await this.getMachineToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/internal${path}`, {
        method,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      const responseBody = await readResponseBody(response);
      if (response.status === 401 && retry) {
        this.machineToken = null;
        return this.machineRequest(method, path, body, false);
      }
      if (!response.ok) {
        const details = readErrorDetails(responseBody);
        throw new IdentityIssuerClientError(
          "http",
          details.message ?? `Identity issuer request failed with status ${response.status}`,
          response.status,
          details.code,
        );
      }
      return responseBody;
    } catch (error) {
      if (error instanceof IdentityIssuerClientError) throw error;
      if (controller.signal.aborted) {
        throw new IdentityIssuerClientError("timeout", "Identity issuer request timed out");
      }
      throw new IdentityIssuerClientError(
        "network",
        error instanceof Error ? error.message : "Identity issuer request failed",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getMachineToken(): Promise<string> {
    if (this.machineToken && this.machineToken.expiresAt > Date.now() + 10_000) {
      return this.machineToken.value;
    }
    if (!this.machineClientId || !this.machineClientSecret) {
      throw new IdentityIssuerClientError(
        "network",
        "Identity machine client credentials are not configured",
      );
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/internal/oauth/token`, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Basic ${Buffer.from(`${this.machineClientId}:${this.machineClientSecret}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "identity.lifecycle",
        }),
        signal: controller.signal,
      });
      const body = await readResponseBody(response);
      if (
        !response.ok ||
        !isRecord(body) ||
        typeof body.access_token !== "string" ||
        typeof body.expires_in !== "number"
      ) {
        throw new IdentityIssuerClientError(
          "http",
          "Identity machine token request failed",
          response.status,
        );
      }
      this.machineToken = {
        value: body.access_token,
        expiresAt: Date.now() + body.expires_in * 1000,
      };
      return body.access_token;
    } catch (error) {
      if (error instanceof IdentityIssuerClientError) throw error;
      if (controller.signal.aborted) {
        throw new IdentityIssuerClientError("timeout", "Identity machine token request timed out");
      }
      throw new IdentityIssuerClientError("network", "Identity machine token request failed");
    } finally {
      clearTimeout(timeout);
    }
  }
}

function forwardHeaders(source?: Headers, defaultOrigin?: string): Headers {
  const output = new Headers({ accept: "application/json", "content-type": "application/json" });
  if (defaultOrigin) output.set("origin", new URL(defaultOrigin).origin);
  if (!source) return output;
  for (const name of FORWARDED_HEADERS) {
    const value = source.get(name);
    if (value) output.set(name, value);
  }
  return output;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function readUserId(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("user" in body)) return null;
  const user = body.user;
  if (!user || typeof user !== "object" || !("id" in user)) return null;
  return typeof user.id === "string" && user.id ? user.id : null;
}

function readErrorDetails(body: unknown): { message?: string; code?: string } {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  return {
    ...(typeof record.message === "string" ? { message: record.message } : {}),
    ...(typeof record.code === "string"
      ? { code: record.code }
      : typeof record.error === "string"
        ? { code: record.error }
        : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function invalidResponse(operation: string): IdentityIssuerClientError {
  return new IdentityIssuerClientError(
    "invalid_response",
    `Identity issuer returned an invalid ${operation} response`,
  );
}

function readSubject(body: unknown): IdentitySubject {
  const candidate = isRecord(body) && "subject" in body ? body.subject : body;
  if (
    !isRecord(candidate) ||
    typeof candidate.id !== "string" ||
    typeof candidate.email !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.emailVerified !== "boolean" ||
    (candidate.mergedIntoSubjectId !== null && typeof candidate.mergedIntoSubjectId !== "string")
  ) {
    throw invalidResponse("subject");
  }
  return {
    id: candidate.id,
    email: candidate.email,
    name: candidate.name,
    emailVerified: candidate.emailVerified,
    identityDisabledAt: readNullableDate(
      candidate.identityDisabledAt,
      "subject.identityDisabledAt",
    ),
    mergedIntoSubjectId: candidate.mergedIntoSubjectId,
  };
}

function readNullableDate(value: unknown, field: string): Date | null {
  if (value === null) return null;
  if (typeof value !== "string") throw invalidResponse(field);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw invalidResponse(field);
  return date;
}

function readSession(value: unknown): IdentitySession {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.expiresAt !== "string" ||
    (value.ipAddress !== null && typeof value.ipAddress !== "string") ||
    (value.userAgent !== null && typeof value.userAgent !== "string") ||
    typeof value.isCurrent !== "boolean"
  ) {
    throw invalidResponse("session");
  }
  return {
    id: value.id,
    createdAt: readNullableDate(value.createdAt, "createdAt") as Date,
    expiresAt: readNullableDate(value.expiresAt, "expiresAt") as Date,
    ipAddress: value.ipAddress,
    userAgent: value.userAgent,
    lastPasswordAuthAt: readNullableDate(value.lastPasswordAuthAt, "lastPasswordAuthAt"),
    isCurrent: value.isCurrent,
  };
}

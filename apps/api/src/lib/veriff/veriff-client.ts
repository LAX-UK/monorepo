import type { Env } from "../../env.js";
import type { VeriffCreateSessionResponse } from "./veriff-types.js";

export class VeriffNotConfiguredError extends Error {
  constructor() {
    super("veriff_not_configured");
    this.name = "VeriffNotConfiguredError";
  }
}

export interface IVeriffClient {
  createSession(input: { userId: string; callbackUrl: string }): Promise<{
    sessionId: string;
    verificationUrl: string;
  }>;
}

export class VeriffClient implements IVeriffClient {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl: string,
  ) {}

  static fromEnv(env: Pick<Env, "VERIFF_API_KEY" | "VERIFF_API_BASE_URL">): VeriffClient {
    return new VeriffClient(
      env.VERIFF_API_KEY,
      env.VERIFF_API_BASE_URL ?? "https://stationapi.veriff.com",
    );
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async createSession(input: { userId: string; callbackUrl: string }): Promise<{
    sessionId: string;
    verificationUrl: string;
  }> {
    if (!this.apiKey) throw new VeriffNotConfiguredError();

    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": this.apiKey,
      },
      body: JSON.stringify({
        verification: {
          callback: input.callbackUrl,
          endUserId: input.userId,
          vendorData: input.userId,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`veriff_create_session_failed:${res.status}:${text.slice(0, 200)}`);
    }

    const body = (await res.json()) as VeriffCreateSessionResponse;
    const sessionId = body.verification?.id;
    const verificationUrl = body.verification?.url;
    if (!sessionId || !verificationUrl) {
      throw new Error("veriff_create_session_invalid_response");
    }

    return { sessionId, verificationUrl };
  }
}

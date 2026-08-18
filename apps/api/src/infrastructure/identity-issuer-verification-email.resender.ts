import { buildVerifyEmailCallbackUrl } from "../lib/verify-email-callback-url.js";
import type { IIdentityIssuerClient } from "../services/interfaces/identity-issuer-client.js";
import type { IVerificationEmailResender } from "../services/interfaces/registration.js";
import { IdentityIssuerClientError } from "./http-identity-issuer.client.js";

export class IdentityIssuerVerificationEmailResender implements IVerificationEmailResender {
  constructor(
    private readonly identityIssuer: IIdentityIssuerClient,
    private readonly webOrigin: string,
  ) {}

  async resend(input: {
    email: string;
    persona?: string;
    inviteToken?: string;
    headers?: Headers;
  }): Promise<{ ok: boolean }> {
    try {
      await this.identityIssuer.sendVerificationEmail({
        email: input.email,
        callbackURL: buildVerifyEmailCallbackUrl(this.webOrigin, input),
        ...(input.headers ? { headers: input.headers } : {}),
      });
      return { ok: true };
    } catch (error) {
      console.warn("[registration] verification email resend failed", {
        kind: error instanceof IdentityIssuerClientError ? error.kind : "unknown",
        status: error instanceof IdentityIssuerClientError ? error.status : undefined,
      });
      return { ok: false };
    }
  }
}

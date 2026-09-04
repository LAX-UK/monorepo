import { buildVerifyEmailCallbackUrl } from "../lib/verify-email-callback-url.js";
import type { IIdentityIssuerClient } from "../services/interfaces/identity-issuer-client.js";
import type { IEmailSignupPersister } from "../services/interfaces/registration.js";
import { IdentityIssuerClientError } from "./http-identity-issuer.client.js";

export class IdentityIssuerEmailSignupPersister implements IEmailSignupPersister {
  constructor(
    private readonly identityIssuer: IIdentityIssuerClient,
    private readonly webOrigin: string,
  ) {}

  async signUpEmail(input: {
    name: string;
    email: string;
    password: string;
    persona?: string;
    inviteToken?: string;
    headers?: Headers;
  }): Promise<
    { ok: true; userId: string } | { ok: false; message: string; status?: number | undefined }
  > {
    try {
      const callbackURL = buildVerifyEmailCallbackUrl(this.webOrigin, {
        email: input.email,
        ...(input.persona ? { persona: input.persona } : {}),
        ...(input.inviteToken ? { inviteToken: input.inviteToken } : {}),
      });
      const result = await this.identityIssuer.signUpEmail({
        name: input.name,
        email: input.email,
        password: input.password,
        callbackURL,
        ...(input.headers ? { headers: input.headers } : {}),
      });
      return { ok: true, userId: result.userId };
    } catch (error) {
      if (error instanceof IdentityIssuerClientError) {
        return {
          ok: false,
          message: error.message,
          status: error.kind === "http" ? error.status : 503,
        };
      }
      return { ok: false, message: "Registration failed", status: 503 };
    }
  }
}

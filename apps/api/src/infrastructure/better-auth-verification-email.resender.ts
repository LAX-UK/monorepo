import type { Auth } from "@auction/auth/server";
import { buildVerifyEmailCallbackUrl } from "../lib/verify-email-callback-url.js";
import type { IVerificationEmailResender } from "../services/interfaces/registration.js";

export class BetterAuthVerificationEmailResender implements IVerificationEmailResender {
  constructor(
    private readonly auth: Auth,
    /** Public web origin (e.g. https://lax.bid) — never the auth issuer subdomain. */
    private readonly webOrigin: string,
  ) {}

  async resend(input: {
    email: string;
    persona?: string;
    inviteToken?: string;
  }): Promise<{ ok: boolean }> {
    try {
      const callbackURL = buildVerifyEmailCallbackUrl(this.webOrigin, input);
      await this.auth.api.sendVerificationEmail({
        body: {
          email: input.email,
          callbackURL,
        },
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}

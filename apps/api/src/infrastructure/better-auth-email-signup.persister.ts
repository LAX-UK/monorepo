import type { Auth } from "@auction/auth/server";
import { buildVerifyEmailCallbackUrl } from "../lib/verify-email-callback-url.js";
import type { IEmailSignupPersister } from "../services/interfaces/registration.js";

export class BetterAuthEmailSignupPersister implements IEmailSignupPersister {
  constructor(
    private readonly auth: Auth,
    /** Public web origin (e.g. https://lax.bid) — never the auth issuer subdomain. */
    private readonly webOrigin: string,
  ) {}

  async signUpEmail(input: {
    name: string;
    email: string;
    password: string;
    persona?: string;
    inviteToken?: string;
  }): Promise<
    { ok: true; userId: string } | { ok: false; message: string; status?: number | undefined }
  > {
    try {
      const callbackURL = buildVerifyEmailCallbackUrl(this.webOrigin, {
        email: input.email,
        ...(input.persona ? { persona: input.persona } : {}),
        ...(input.inviteToken ? { inviteToken: input.inviteToken } : {}),
      });
      const result = await this.auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
          callbackURL,
        },
      });
      const userId =
        result?.user && typeof result.user === "object" && "id" in result.user
          ? String((result.user as { id: string }).id)
          : "";
      if (!userId) {
        return { ok: false, message: "Could not create account", status: 400 };
      }
      return { ok: true, userId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      return { ok: false, message: msg, status: 400 };
    }
  }
}

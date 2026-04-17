import type { Auth } from "@auction/auth/server";
import type {
  IRegistrationPersister,
  RegistrationInput,
} from "../services/interfaces/registration.js";

export class BetterAuthRegistrationPersister implements IRegistrationPersister {
  constructor(private readonly auth: Auth) {}

  async register(
    input: RegistrationInput,
  ): Promise<
    { ok: true; userId: string } | { ok: false; message: string; status?: number | undefined }
  > {
    try {
      const result = await this.auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
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

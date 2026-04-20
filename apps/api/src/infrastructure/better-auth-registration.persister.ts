import type { Auth } from "@auction/auth/server";
import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  IRegistrationPersister,
  RegistrationInput,
} from "../services/interfaces/registration.js";

export class BetterAuthRegistrationPersister implements IRegistrationPersister {
  constructor(
    private readonly auth: Auth,
    private readonly db: Database,
  ) {}

  async register(
    input: RegistrationInput,
  ): Promise<
    { ok: true; userId: string } | { ok: false; message: string; status?: number | undefined }
  > {
    const displayName = `${input.firstName} ${input.lastName}`.trim();
    try {
      const result = await this.auth.api.signUpEmail({
        body: {
          name: displayName,
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
      await this.db
        .update(user)
        .set({
          firstName: input.firstName,
          lastName: input.lastName,
          mobile: input.mobile ?? null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
      return { ok: true, userId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      return { ok: false, message: msg, status: 400 };
    }
  }
}

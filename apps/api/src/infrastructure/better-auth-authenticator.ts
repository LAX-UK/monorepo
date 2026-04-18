import type { Auth } from "@auction/auth/server";
import type { AuthenticatedUser, IAuthenticator } from "../services/interfaces/authenticator.js";

export class BetterAuthAuthenticator implements IAuthenticator {
  constructor(private readonly auth: Auth) {}

  async getSessionUser(headers: Headers): Promise<AuthenticatedUser | null> {
    const session = await this.auth.api.getSession({ headers });
    const id = session?.user?.id;
    if (!id) return null;
    const role =
      typeof session?.user === "object" && session.user && "role" in session.user
        ? String((session.user as { role?: string }).role ?? "user")
        : "user";
    return { id, role };
  }
}

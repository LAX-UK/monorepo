import type { Auth } from "@auction/auth/server";
import { normalizeUserRoleOrClient } from "@auction/types";
import type { AuthenticatedUser, IAuthenticator } from "../services/interfaces/authenticator.js";

export class BetterAuthAuthenticator implements IAuthenticator {
  constructor(private readonly auth: Auth) {}

  async getSessionUser(headers: Headers): Promise<AuthenticatedUser | null> {
    const session = await this.auth.api.getSession({ headers });
    const id = session?.user?.id;
    if (!id) return null;
    const rawRole =
      typeof session?.user === "object" && session.user && "role" in session.user
        ? String((session.user as { role?: string }).role ?? "client")
        : "client";
    const role = normalizeUserRoleOrClient(rawRole);
    return { id, role };
  }
}

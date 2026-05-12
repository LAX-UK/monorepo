import type { Auth } from "@auction/auth/server";
import { normalizeUserRoleOrClient, normalizeUserStaffRole } from "@auction/types";
import type { AuthenticatedUser, IAuthenticator } from "../services/interfaces/authenticator.js";

export class BetterAuthAuthenticator implements IAuthenticator {
  constructor(private readonly auth: Auth) {}

  async getSessionUser(headers: Headers): Promise<AuthenticatedUser | null> {
    const session = await this.auth.api.getSession({ headers });
    const id = session?.user?.id;
    if (!id) return null;
    const u = session?.user as { role?: string; staffRole?: string | null } | null | undefined;
    const rawRole =
      typeof u === "object" && u && "role" in u ? String(u.role ?? "client") : "client";
    const role = normalizeUserRoleOrClient(rawRole);
    const staffRole =
      typeof u === "object" && u && "staffRole" in u ? normalizeUserStaffRole(u.staffRole) : null;
    return { id, role, staffRole };
  }
}

import { verifyBearerToken } from "@auction/auth";
import { normalizeUserRoleOrClient, normalizeUserStaffRole } from "@auction/types";
import type { AuthenticatedUser, IAuthenticator } from "../services/interfaces/authenticator.js";

export type JwtAuthenticatorOptions = {
  issuer: string;
  jwksUrl: string;
  audience?: string | string[] | undefined;
};

export class JwtAuthenticator implements IAuthenticator {
  constructor(private readonly opts: JwtAuthenticatorOptions) {}

  async getSessionUser(headers: Headers): Promise<AuthenticatedUser | null> {
    const verified = await verifyBearerToken({
      authorization: headers.get("authorization"),
      jwksUrl: this.opts.jwksUrl,
      issuer: this.opts.issuer,
      audience: this.opts.audience,
    });
    if (!verified) return null;
    const role = normalizeUserRoleOrClient(String(verified.payload.role ?? "client"));
    const staffRole = normalizeUserStaffRole(
      typeof verified.payload.staff_role === "string" ? verified.payload.staff_role : undefined,
    );
    return { id: verified.subject, role, staffRole };
  }
}

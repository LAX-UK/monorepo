import { verifyBearerToken } from "@auction/auth/token-verifier";
import { normalizeUserRoleOrClient, normalizeUserStaffRole } from "@auction/types";
import type { AuthenticatedUser, IAuthenticator } from "../services/interfaces/authenticator.js";

export type JwtAuthenticatorOptions = {
  issuer: string;
  jwksUrl: string;
  audience: string;
  allowLegacyLaxApiAudience?: boolean;
  onLegacyAudienceAccepted?: () => void;
};

export class JwtAuthenticator implements IAuthenticator {
  constructor(private readonly opts: JwtAuthenticatorOptions) {}

  async getSessionUser(headers: Headers): Promise<AuthenticatedUser | null> {
    let verified = await verifyBearerToken({
      authorization: headers.get("authorization"),
      jwksUrl: this.opts.jwksUrl,
      issuer: this.opts.issuer,
      audience: this.opts.audience,
    });
    if (!verified && this.opts.allowLegacyLaxApiAudience) {
      verified = await verifyBearerToken({
        authorization: headers.get("authorization"),
        jwksUrl: this.opts.jwksUrl,
        issuer: this.opts.issuer,
        audience: "lax-api",
      });
      if (verified) this.opts.onLegacyAudienceAccepted?.();
    }
    if (!verified) return null;
    const role = normalizeUserRoleOrClient(String(verified.payload.role ?? "client"));
    const staffRole = normalizeUserStaffRole(
      typeof verified.payload.staff_role === "string" ? verified.payload.staff_role : undefined,
    );
    return {
      id: verified.subject,
      scopes:
        typeof verified.payload.scope === "string"
          ? verified.payload.scope.split(/\s+/).filter(Boolean)
          : [],
      role,
      staffRole,
      ...(typeof verified.payload.sid === "string"
        ? { identitySessionId: verified.payload.sid }
        : {}),
    };
  }
}

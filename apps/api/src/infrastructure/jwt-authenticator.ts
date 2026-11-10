import { bearerRejectionCode, verifyBearerToken } from "@auction/auth/token-verifier";
import { normalizeUserRoleOrClient, normalizeUserStaffRole } from "@auction/types";
import type {
  AuthRejectionReason,
  AuthenticatedUser,
  IAuthenticator,
} from "../services/interfaces/authenticator.js";

/** Clock slack between the issuer and this API when checking `exp` and `nbf`. */
export const ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS = 5;

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
      clockToleranceSeconds: ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS,
    });
    if (!verified && this.opts.allowLegacyLaxApiAudience) {
      verified = await verifyBearerToken({
        authorization: headers.get("authorization"),
        jwksUrl: this.opts.jwksUrl,
        issuer: this.opts.issuer,
        audience: "lax-api",
        clockToleranceSeconds: ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS,
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

      staffRoles: staffRole ? [staffRole] : [],
      ...(typeof verified.payload.sid === "string"
        ? { identitySessionId: verified.payload.sid }
        : {}),
    };
  }

  async diagnoseRejection(headers: Headers): Promise<AuthRejectionReason | null> {
    try {
      return await bearerRejectionCode({
        authorization: headers.get("authorization"),
        jwksUrl: this.opts.jwksUrl,
        issuer: this.opts.issuer,
        audience: this.opts.audience,
        clockToleranceSeconds: ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS,
      });
    } catch {
      return null;
    }
  }
}

import { APIError } from "better-auth/api";
import {
  OidcAuthorizationCodeCorrelationError,
  type OidcAuthorizationCodeCorrelationReason,
} from "../services/oidc-session-coordinator.js";

export type OidcClaims = {
  sid?: string;
  auth_time?: number;
  acr?: string;
  amr?: string[];
};

type OidcClaimsResolver = (input: {
  subjectId: string;
  clientId: string;
}) => Promise<OidcClaims>;

/**
 * Maps Identity's private correlation failure to the OAuth token endpoint
 * contract at the Better Auth adapter boundary.
 */
export function adaptOidcClaimsResolver(
  resolve: OidcClaimsResolver,
  logCorrelationRejection?: (reason: OidcAuthorizationCodeCorrelationReason) => void,
): OidcClaimsResolver {
  return async (input) => {
    try {
      return await resolve(input);
    } catch (error) {
      if (error instanceof OidcAuthorizationCodeCorrelationError) {
        logCorrelationRejection?.(error.reason);
        throw new APIError("BAD_REQUEST", {
          error: "invalid_grant",
          error_description: "Authorization code is invalid or has already been consumed",
        });
      }
      throw error;
    }
  };
}

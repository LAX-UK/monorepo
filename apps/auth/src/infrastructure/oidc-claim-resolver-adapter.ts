import { APIError } from "better-auth/api";
import { OidcAuthorizationCodeCorrelationError } from "../services/oidc-session-coordinator.js";

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
export function adaptOidcClaimsResolver(resolve: OidcClaimsResolver): OidcClaimsResolver {
  return async (input) => {
    try {
      return await resolve(input);
    } catch (error) {
      if (error instanceof OidcAuthorizationCodeCorrelationError) {
        throw new APIError("BAD_REQUEST", {
          error: "invalid_grant",
          error_description: "Authorization code is invalid or has already been consumed",
        });
      }
      throw error;
    }
  };
}

import type { StaffRoles, UserRole } from "@auction/types";

/** ISP: middleware depends only on session resolution, not the full auth stack. */
export type AuthenticatedUser = {
  id: string;
  /** Namespaced resource scopes carried by the verified access token. */
  scopes: readonly string[];
  /** Identity session id carried as OIDC `sid`; used for server-side step-up correlation. */
  identitySessionId?: string;
  role: UserRole;
  /** Staff roles in force for this request; every permission check uses these. */
  staffRoles: StaffRoles;
};

/** Why a request that carried a credential was not authenticated, when that is worth telling. */
export type AuthRejectionReason = "token_key_unknown";

export interface IAuthenticator {
  getSessionUser(headers: Headers): Promise<AuthenticatedUser | null>;
  /**
   * Called only after `getSessionUser` returned `null`. Names the one rejection a client can act
   * on: the access token was signed by a key the issuer no longer publishes. `null` for every
   * other failure, so those stay indistinguishable from each other.
   */
  diagnoseRejection?(headers: Headers): Promise<AuthRejectionReason | null>;
}

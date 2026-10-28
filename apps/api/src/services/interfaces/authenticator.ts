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

export interface IAuthenticator {
  getSessionUser(headers: Headers): Promise<AuthenticatedUser | null>;
}

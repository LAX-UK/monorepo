import type { UserRole, UserStaffRole } from "@auction/types";

/** ISP: middleware depends only on session resolution, not the full auth stack. */
export type AuthenticatedUser = {
  id: string;
  /** Namespaced resource scopes carried by the verified access token. */
  scopes: readonly string[];
  /** Identity session id carried as OIDC `sid`; used for server-side step-up correlation. */
  identitySessionId?: string;
  role: UserRole;
  /** LAX internal staff specialization when `role` is `staff`. */
  staffRole?: UserStaffRole | null;
};

export interface IAuthenticator {
  getSessionUser(headers: Headers): Promise<AuthenticatedUser | null>;
}

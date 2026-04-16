/** ISP: middleware depends only on session resolution, not the full auth stack. */
export type AuthenticatedUser = {
  id: string;
  role: string;
};

export interface IAuthenticator {
  getSessionUser(headers: Headers): Promise<AuthenticatedUser | null>;
}

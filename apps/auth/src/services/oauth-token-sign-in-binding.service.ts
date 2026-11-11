import { decodeJwt } from "jose";

export interface OAuthTokenSignInStore {
  /** Records the sign-in on the token row that holds `refreshToken`; false when there is no such row. */
  bindRefreshToken(refreshToken: string, sid: string): Promise<boolean>;
  /** Deletes the token row that holds `refreshToken`. */
  discardRefreshToken(refreshToken: string): Promise<void>;
}

/**
 * Records which sign-in each OAuth token was issued under, from the `sid` of the ID token returned
 * with it, so that signing out of that sign-in can delete those tokens and no others.
 */
export class OAuthTokenSignInBinding {
  constructor(private readonly store: OAuthTokenSignInStore) {}

  /**
   * Fails closed: when the sign-in cannot be recorded the tokens are deleted and this throws, so a
   * token that no sign-out could ever find is never handed out.
   */
  async bindIssued(input: { refreshToken: string; idToken: string }): Promise<void> {
    try {
      const { sid } = decodeJwt(input.idToken);
      if (typeof sid !== "string" || sid.length === 0) {
        throw new Error("OIDC token response carries no sid");
      }
      if (!(await this.store.bindRefreshToken(input.refreshToken, sid))) {
        throw new Error("OIDC token row was not persisted");
      }
    } catch (error) {
      await this.store.discardRefreshToken(input.refreshToken);
      throw error;
    }
  }
}

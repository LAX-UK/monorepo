export type OidcRefreshResult = {
  idToken: string;
  refreshToken: string;
  refreshExpiresAt: Date | null;
};

export interface OidcRefreshClient {
  refresh(refreshToken: string): Promise<OidcRefreshResult>;
}

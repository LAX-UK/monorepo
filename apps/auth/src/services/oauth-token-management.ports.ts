import type { RegisteredOidcClientId } from "@auction/identity-contracts";

export type ManagedOauthToken = {
  id: string;
  clientId: string;
  userId: string | null;
  scopes: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  refreshFamilyId: string | null;
  refreshConsumedAt: Date | null;
  createdAt: Date;
};

export type OauthTokenLookup = {
  requesterClientId: RegisteredOidcClientId;
  accessTokenCandidates: readonly string[];
  refreshTokenCandidates: readonly string[];
};

export type OauthTokenStore = {
  findByClientAndToken(input: OauthTokenLookup): Promise<ManagedOauthToken | null>;
  deleteToken(tokenId: string): Promise<void>;
  deleteRefreshFamily(refreshFamilyId: string): Promise<void>;
};

import type { IdTokenClaims, TokenResponse } from "../../oidc.js";

export type ShopUserProfileReadModel = {
  identitySubjectId: string;
  email: string | null;
  name: string | null;
  disabledAt: Date | null;
};

export type VerifiedShopIdentity = {
  subject: string;
  payload: Record<string, unknown>;
};

export interface OAuthCodeExchanger {
  exchange(input: { code: string; codeVerifier: string }): Promise<TokenResponse>;
}

export interface IdentityTokenVerifier {
  decode(token: string): IdTokenClaims;
  validateClaims(claims: IdTokenClaims, expectedNonce: string): boolean;
  verify(token: string): Promise<VerifiedShopIdentity | null>;
}

export interface ShopProfileDirectory {
  upsert(input: {
    identitySubjectId: string;
    email: string | null;
    name: string | null;
  }): Promise<void>;
  find(identitySubjectId: string): Promise<ShopUserProfileReadModel | null>;
}

export interface AuthenticatedSessionWriter {
  authenticate(input: { id: string; subject: string; sid: string }): Promise<string>;
  invalidate(id: string | null): Promise<void>;
}

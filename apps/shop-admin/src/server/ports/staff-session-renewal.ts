import type { OidcTokenResponse } from "@auction/identity-rp";

/** The issuer calls a staff session needs to carry on after its Shop API token expires. */
export interface StaffSessionRenewal {
  refresh(refreshToken: string): Promise<OidcTokenResponse>;
  /** The verified claims of a renewed ID token, or null when it does not verify. */
  verifyIdToken(idToken: string): Promise<{ authTime?: number; acr?: string } | null>;
  exchangeForShopApi(idToken: string): Promise<{ accessToken: string; expiresInSeconds: number }>;
}

export type IdentityJwtSignInput = {
  typ: string;
  issuer: string;
  audience: string | string[];
  claims: Record<string, unknown>;
  subject?: string | undefined;
  issuedAt?: number | undefined;
  expirationTime?: string | undefined;
  jwtId?: string | undefined;
  algorithm?: string | undefined;
};

/** Signs Identity-issued JWTs without exposing stored private key material. */
export type IdentityJwtSigner = {
  sign(input: IdentityJwtSignInput): Promise<{ token: string; kid: string }>;
};

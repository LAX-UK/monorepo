export type StoredSigningJwk = {
  id: string;
  publicKey: string;
  privateKey: string;
  alg?: string | undefined;
};

/** Read-only JWKS access for verification and signing adapter wiring. */
export type JwksProvider = {
  getJwks(): Promise<StoredSigningJwk[]>;
  getActiveSigningJwk(): Promise<StoredSigningJwk | null>;
};

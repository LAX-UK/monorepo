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

/** Reads which key is active and when it was created, without touching key material. */
export type SigningKeyInfoReader = {
  getActiveSigningKeyInfo(): Promise<{ kid: string; createdAt: Date } | null>;
};

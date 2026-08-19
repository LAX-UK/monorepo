import type { Jwk } from "better-auth/plugins/jwt";

export type JwksStore = {
  getJwks(): Promise<Jwk[]>;
  getActiveSigningJwk(): Promise<Jwk | null>;
  createJwk(data: Omit<Jwk, "id">): Promise<Jwk>;
  getPublicJwks(): Promise<{ keys: unknown[] }>;
  markKeyRetired(kid: string): Promise<void>;
};

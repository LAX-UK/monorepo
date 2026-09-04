import {
  type VerifiedIdentityToken,
  verifyIdentityToken,
} from "@auction/identity-contracts/verify";

export type VerifiedToken = VerifiedIdentityToken;

/** Verify Bearer JWT from the auth issuer. Invalid/expired tokens return `null` (never throw). */
export async function verifyBearerToken(options: {
  authorization: string | null | undefined;
  jwksUrl: string;
  issuer: string;
  /** Required — defaults to {@link DEFAULT_JWT_AUDIENCE}. */
  audience?: string | string[] | undefined;
}): Promise<VerifiedToken | null> {
  const header = options.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return verifyIdentityToken({
    token: header.slice("Bearer ".length),
    jwksUrl: options.jwksUrl,
    issuer: options.issuer,
    ...(options.audience === undefined ? {} : { audience: options.audience }),
  });
}

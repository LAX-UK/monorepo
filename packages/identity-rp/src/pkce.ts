import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type OAuthLoginParams = {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
};

export function generateOAuthLoginParams(): OAuthLoginParams {
  const codeVerifier = randomBytes(32).toString("base64url");
  return {
    state: randomBytes(24).toString("base64url"),
    nonce: randomBytes(24).toString("base64url"),
    codeVerifier,
    codeChallenge: createHash("sha256").update(codeVerifier).digest("base64url"),
  };
}

export function validateOAuthStateExact(
  expectedState: string | undefined,
  receivedState: string | null,
): boolean {
  if (!expectedState || !receivedState) return false;
  return expectedState === receivedState;
}

export function validateOAuthStateTimingSafe(expected: string, received: string | null): boolean {
  if (!received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

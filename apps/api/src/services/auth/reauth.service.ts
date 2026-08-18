import { IdentityIssuerClientError } from "../../infrastructure/http-identity-issuer.client.js";
import type { IIdentityCredentialClient } from "../interfaces/identity-issuer-client.js";

/** Re-prove password for the current cookie session and stamp `last_password_auth_at`. */
export async function stampReauthWithPassword(opts: {
  identityIssuer: IIdentityCredentialClient;
  userId: string;
  password: string;
  sessionTokenFromCookie: string | null;
}): Promise<"ok" | "invalid_password" | "no_session" | "no_credential"> {
  if (!opts.sessionTokenFromCookie) return "no_session";
  try {
    await opts.identityIssuer.verifyPasswordAndStamp({
      subjectId: opts.userId,
      password: opts.password,
      sessionToken: opts.sessionTokenFromCookie,
    });
    return "ok";
  } catch (error) {
    if (error instanceof IdentityIssuerClientError) {
      if (error.code === "invalid_password") return "invalid_password";
      if (error.code === "no_credential") return "no_credential";
      if (error.code === "no_session") return "no_session";
    }
    throw error;
  }
}

import {
  buildMagicLinkExpiredCallbackUrl,
  buildMagicLinkSetPasswordCallbackUrl,
} from "@auction/auth/magic-link-callback";
import type { IIdentityIssuerClient } from "../interfaces/identity-issuer-client.js";

/** Requests a password-setup magic link from the Identity issuer. */
export async function requestMagicLinkForEmail(args: {
  identityIssuer: IIdentityIssuerClient;
  email: string;
  webOrigin: string;
  next?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number }> {
  const webBase = args.webOrigin.replace(/\/$/, "");
  try {
    await args.identityIssuer.requestMagicLink({
      email: args.email.trim().toLowerCase(),
      callbackURL: buildMagicLinkSetPasswordCallbackUrl(webBase, args.next),
      errorCallbackURL: buildMagicLinkExpiredCallbackUrl(webBase),
    });
    return { ok: true };
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error && typeof error.status === "number"
        ? error.status
        : 503;
    return { ok: false, status };
  }
}

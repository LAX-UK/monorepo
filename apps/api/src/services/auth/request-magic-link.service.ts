import {
  buildMagicLinkExpiredCallbackUrl,
  buildMagicLinkSetPasswordCallbackUrl,
} from "@auction/auth/magic-link-callback";
import type { Auth } from "@auction/auth/server";

type AuthWithHandler = Auth & {
  handler: (request: Request) => Promise<Response>;
};

/** Server-side magic-link request (Better Auth sign-in/magic-link). Used by forgot-password + ops scripts. */
export async function requestMagicLinkForEmail(args: {
  auth: AuthWithHandler;
  issuerBaseUrl: string;
  email: string;
  webOrigin: string;
  next?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number }> {
  const issuer = args.issuerBaseUrl.replace(/\/$/, "");
  const webBase = args.webOrigin.replace(/\/$/, "");
  const res = await args.auth.handler(
    new Request(`${issuer}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: args.email.trim().toLowerCase(),
        callbackURL: buildMagicLinkSetPasswordCallbackUrl(webBase, args.next),
        errorCallbackURL: buildMagicLinkExpiredCallbackUrl(webBase),
      }),
    }),
  );
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

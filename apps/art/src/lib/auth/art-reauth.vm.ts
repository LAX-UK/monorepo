import { artStorefrontLoginHref } from "@/lib/art-viewer-state";
import { safeRelativeReturnPath } from "@auction/identity-rp/safe-return-path";

const PATH_ORIGIN = "https://art-return.invalid";

/** Returning here after sign-in would loop back into auth or the status page itself. */
const NON_RETURNABLE_PREFIXES = [
  "/login",
  "/register",
  "/logout",
  "/auth",
  "/signed-out",
  "/session-expired",
  "/sign-in-error",
] as const;

export const ART_CONTINUE_BROWSING_HREF = "/artworks";

function isNonReturnable(path: string): boolean {
  const pathname = new URL(path, PATH_ORIGIN).pathname;
  return NON_RETURNABLE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Same-origin relative `returnTo` for "Sign in again", or `fallback` when missing or unsafe. */
export function resolveArtReauthReturnTo(
  raw: string | string[] | undefined,
  fallback: string,
): string {
  const safe = safeRelativeReturnPath(Array.isArray(raw) ? raw[0] : raw);
  if (!safe || isNonReturnable(safe)) return fallback;
  return safe;
}

/** Storefront `/login` href that returns to `raw` when it is safe, otherwise to `fallback`. */
export function artSignInHref(raw: string | string[] | undefined, fallback = "/"): string {
  return artStorefrontLoginHref(resolveArtReauthReturnTo(raw, fallback));
}

export type ArtReauthVm = {
  signInHref: string;
  continueHref: string;
};

export function buildArtReauthVm(
  raw: string | string[] | undefined,
  fallback: string,
): ArtReauthVm {
  return {
    signInHref: artSignInHref(raw, fallback),
    continueHref: ART_CONTINUE_BROWSING_HREF,
  };
}

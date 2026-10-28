import { ACCOUNT_ROUTES } from "./account-settings.vm";
import { type SignInNoticeVm, signInNotice } from "./sign-in-notice.vm";

/** Starts sign-in and brings the person back to Home, as every signed-out `/account` page does. */
export const ACCOUNT_SIGN_IN_HREF = `/api/auth/login?returnTo=${ACCOUNT_ROUTES.overview}`;

/** The session states `/` tells apart (`AccountSessionState["status"]`). */
export type LandingSessionStatus = "ok" | "unsigned" | "unavailable";

export type AccountLandingDecision =
  | { kind: "notice"; notice: SignInNoticeVm }
  | { kind: "redirect"; to: string };

/**
 * Where `/` sends each session state. A store outage goes to Home, which already explains it and
 * offers a retry; sending that person to sign-in would only fail again at the callback.
 */
const DESTINATION: Readonly<Record<LandingSessionStatus, string>> = {
  ok: ACCOUNT_ROUTES.overview,
  unavailable: ACCOUNT_ROUTES.overview,
  unsigned: ACCOUNT_SIGN_IN_HREF,
};

/**
 * `/` has no page of its own. A sign-in that failed comes back here with `?error=` and is told
 * what happened; everyone else goes straight on: signed-in people to Home, signed-out people to
 * sign-in, whose pages carry the one-account message. The session is read only when there is no
 * notice, because the notice is shown whatever the session.
 */
export async function decideAccountLanding(
  errorReason: string | null | undefined,
  readSessionStatus: () => Promise<LandingSessionStatus>,
): Promise<AccountLandingDecision> {
  const notice = signInNotice(errorReason);
  if (notice) return { kind: "notice", notice };
  return { kind: "redirect", to: DESTINATION[await readSessionStatus()] };
}

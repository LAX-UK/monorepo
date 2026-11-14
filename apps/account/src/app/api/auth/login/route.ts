import { PENDING_LOGIN_MAX_AGE_SECONDS, sealPendingLogin } from "@/lib/pending-login-cookie";
import { safeReturnTo } from "@/lib/safe-return-to";
import { STEP_UP_SIGNED_OUT_PATH } from "@/lib/step-up-complete";
import { getLaxAccountContainer } from "@/server/container";
import {
  REAUTH_DISPLAY_POPUP,
  REAUTH_DISPLAY_QUERY,
  REAUTH_REASON_QUERY,
  STEP_UP_COMPLETE_PATH,
} from "@/server/domain/account-reauth";
import { parseAccountStepUpReason } from "@auction/identity-contracts";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function signedInSubject(
  container: ReturnType<typeof getLaxAccountContainer>,
  sessionId: string | undefined,
): Promise<string | null> {
  if (!sessionId) return null;
  try {
    return (await container.sessions.get(sessionId))?.subject ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const container = getLaxAccountContainer();
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const reauth = url.searchParams.get("intent") === "reauth";
  // A step-up in the "Confirm it's you" window always ends on the fixed page that reports back to
  // Account; nothing in the address can choose another destination.
  const popup = reauth && url.searchParams.get(REAUTH_DISPLAY_QUERY) === REAUTH_DISPLAY_POPUP;
  const returnTo = popup ? STEP_UP_COMPLETE_PATH : safeReturnTo(url.searchParams.get("returnTo"));
  // A step-up is for the person signed in here now; its subject is what the sign-in must return.
  const reauthSubject = reauth
    ? await signedInSubject(container, cookieStore.get(container.cookies.sessionCookie)?.value)
    : null;
  if (popup && !reauthSubject) {
    // Nobody is signed in to Account any more, so there is nobody for the window to confirm. An
    // ordinary sign-in here could be anyone's, and the page behind would run its action again
    // under their session against the first person's data. So no sign-in starts in the window:
    // it tells the page, which signs in on a full page and reloads with whoever signs in.
    return NextResponse.redirect(new URL(STEP_UP_SIGNED_OUT_PATH, container.config.publicOrigin));
  }
  // Read against the fixed list: anything else is dropped, so no text from the address is ever shown.
  const reason = parseAccountStepUpReason(url.searchParams.get(REAUTH_REASON_QUERY));
  const { authorizeUrl, pending } = container.startAccountLogin({
    config: container.config,
    returnTo,
    ...(reauthSubject ? { reauth: { subject: reauthSubject, ...(reason ? { reason } : {}) } } : {}),
  });
  cookieStore.set(
    container.cookies.loginCookie,
    sealPendingLogin(JSON.stringify(pending), container.config.sessionEncryptionKey),
    {
      httpOnly: true,
      secure: container.cookies.secure,
      sameSite: "lax",
      path: "/",
      maxAge: PENDING_LOGIN_MAX_AGE_SECONDS,
    },
  );
  return NextResponse.redirect(authorizeUrl);
}

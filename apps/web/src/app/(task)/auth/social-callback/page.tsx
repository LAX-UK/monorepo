import { isSafeNextPath, resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { redirect } from "next/navigation";

/** Post-OAuth landing: resolve role-aware destination after Better Auth sets the session. */
export default async function SocialCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const oauthError = typeof sp.error === "string" ? sp.error : undefined;
  if (oauthError) {
    const reason = encodeURIComponent(oauthError);
    redirect(`/login?social_error=1&reason=${reason}`);
  }

  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?social_error=1&reason=session_missing");
  }

  if (user.suspended === true) {
    redirect("/account-suspended");
  }

  const requestedNext = typeof sp.next === "string" ? sp.next : null;
  const dest = resolvePostAuthDestination({
    user,
    requestedNext: isSafeNextPath(requestedNext ?? undefined) ? requestedNext : null,
    context: "sign-in",
    requireEmailVerification: false,
    withWelcomeBack: true,
  });
  redirect(dest);
}

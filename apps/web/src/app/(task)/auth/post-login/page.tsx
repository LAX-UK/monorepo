import { PostLoginHandoff } from "@/components/auth/post-login-handoff";
import { resolveSilentPostLoginDestination } from "@/lib/auth/post-auth-destination";
import { resolveServerPostAuthDestination } from "@/lib/auth/post-auth-destination.server";
import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { redirect } from "next/navigation";

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    welcome?: string;
    auth_fresh?: string;
    entry_intent?: string;
  }>;
}) {
  const [params, user] = await Promise.all([searchParams, getServerSessionUser()]);
  const requestedNext =
    params.next && isSafeNextPath(params.next) ? params.next : null;

  if (!user) {
    const loginParams = new URLSearchParams({ session_expired: "1" });
    if (requestedNext) loginParams.set("next", requestedNext);
    redirect(`/login?${loginParams.toString()}`);
  }

  const destination =
    params.entry_intent === "silent"
      ? resolveSilentPostLoginDestination(user, requestedNext)
      : resolveServerPostAuthDestination({
          user,
          requestedNext,
          context: "sign-in",
          requireEmailVerification: false,
          withWelcomeBack: params.welcome === "back",
        });
  if (params.auth_fresh === "1") {
    return <PostLoginHandoff destination={destination} entryIntent={params.entry_intent ?? null} />;
  }

  redirect(destination);
}

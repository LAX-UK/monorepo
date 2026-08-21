import { resolveServerPostAuthDestination } from "@/lib/auth/post-auth-destination.server";
import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { redirect } from "next/navigation";

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; welcome?: string }>;
}) {
  const [params, user] = await Promise.all([searchParams, getServerSessionUser()]);
  const requestedNext = isSafeNextPath(params.next) ? params.next : null;

  if (!user) {
    const loginParams = new URLSearchParams({ session_expired: "1" });
    if (requestedNext) loginParams.set("next", requestedNext);
    redirect(`/login?${loginParams.toString()}`);
  }

  redirect(
    resolveServerPostAuthDestination({
      user,
      requestedNext,
      context: "sign-in",
      requireEmailVerification: false,
      withWelcomeBack: params.welcome === "back",
    }),
  );
}

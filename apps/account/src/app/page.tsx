import { Button } from "@/components/account-button";
import { SignInSplit } from "@/components/sign-in-split";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import { ACCOUNT_SIGN_IN_HREF, decideAccountLanding } from "@/server/domain/account-landing";
import { buildAccountLinks } from "@/server/domain/account-links";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * `/` only speaks when a sign-in came back with an error; otherwise it sends people on (see
 * `decideAccountLanding`). The notice keeps the sign-in pages' frame so the flow stays one piece.
 */
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const decision = await decideAccountLanding(
    error,
    async () => (await loadAccountSession()).status,
  );
  if (decision.kind === "redirect") redirect(decision.to);

  const { notice } = decision;
  const { support } = buildAccountLinks(getLaxAccountContainer().config);
  return (
    <SignInSplit support={support}>
      <div className="flex flex-col gap-3" role={notice.tone === "error" ? "alert" : "status"}>
        <h1 className="font-headline text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {notice.title}
        </h1>
        <p className="text-base leading-7 text-on-surface-variant">{notice.message}</p>
      </div>
      <Button asChild variant="cta" className="w-full">
        <a href={ACCOUNT_SIGN_IN_HREF}>Try signing in again</a>
      </Button>
    </SignInSplit>
  );
}

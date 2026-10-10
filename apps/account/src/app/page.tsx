import { AccountShell, Notice, primaryButton } from "@/components/account-ui";
import { loadAccountSession } from "@/server/application/load-account-session";
import { signInNotice } from "@/server/domain/sign-in-notice.vm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const notice = signInNotice(error);
  const session = await loadAccountSession();
  if (session.status === "ok" && !notice) redirect("/account");

  return (
    <AccountShell>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Your LAX account</h1>
          <p className="text-sm leading-6 text-on-surface-variant">
            Sign in once to manage your profile, password and two-step verification for every LAX
            product.
          </p>
        </div>
        {notice ? (
          <Notice tone={notice.tone} title={notice.title}>
            {notice.message}
          </Notice>
        ) : null}
        <a href="/api/auth/login?returnTo=/account" className={primaryButton}>
          {notice ? "Try signing in again" : "Sign in"}
        </a>
        <p className="text-xs text-on-surface-variant">
          New to LAX? Choose “Sign up” on the next screen.
        </p>
      </div>
    </AccountShell>
  );
}

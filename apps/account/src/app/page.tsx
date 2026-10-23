import { AccountShell } from "@/components/account-shell";
import { NoticeTitle } from "@/components/account-ui";
import { LANDING_CAPABILITIES, ONE_ACCOUNT_MESSAGE } from "@/lib/account-copy";
import { loadAccountSession } from "@/server/application/load-account-session";
import { signInNotice } from "@/server/domain/sign-in-notice.vm";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
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
          <h1 className="font-headline text-3xl font-semibold tracking-tight">LAX Account</h1>
          <p className="text-base font-medium text-on-surface">{ONE_ACCOUNT_MESSAGE}</p>
          <p className="text-sm leading-6 text-on-surface-variant">
            Sign in once. Your details, security and preferences go with you.
          </p>
        </div>
        {notice ? (
          <Alert
            variant={notice.tone === "error" ? "destructive" : "default"}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            <NoticeTitle>{notice.title}</NoticeTitle>
            <AlertDescription className="text-on-surface-variant">
              {notice.message}
            </AlertDescription>
          </Alert>
        ) : null}
        <Button asChild variant="cta" size="lg">
          <a href="/api/auth/login?returnTo=/account">
            {notice ? "Try signing in again" : "Sign in"}
          </a>
        </Button>
        <p className="text-xs text-on-surface-variant">
          New to LAX? Choose “Sign up” on the next screen.
        </p>
        <section aria-labelledby="what-you-can-do" className="flex flex-col gap-3">
          <h2 id="what-you-can-do" className="font-headline text-lg font-semibold">
            What you can do here
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-on-surface-variant marker:text-product-accent">
            {LANDING_CAPABILITIES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </AccountShell>
  );
}

import { AccountShell } from "@/components/account-shell";
import { loadAccountSession } from "@/server/application/load-account-session";
import { signInNotice } from "@/server/domain/sign-in-notice.vm";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
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
          <h1 className="font-headline text-3xl font-semibold tracking-tight">Your LAX account</h1>
          <p className="text-sm leading-6 text-on-surface-variant">
            Sign in once to manage your profile, password and two-step verification for every LAX
            product.
          </p>
        </div>
        {notice ? (
          <Alert
            variant={notice.tone === "error" ? "destructive" : "default"}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            <AlertTitle>{notice.title}</AlertTitle>
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
      </div>
    </AccountShell>
  );
}

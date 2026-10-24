import { Button } from "@/components/account-button";
import { AccountShell } from "@/components/account-shell";
import { connection } from "next/server";

export default async function NotFound() {
  // The shell reads the session and the configured product links, so this page renders per
  // request; a not-found page cannot use `dynamic = "force-dynamic"` like the other pages.
  await connection();
  return (
    <AccountShell>
      <div className="flex w-full flex-col items-start gap-4 py-6">
        <h1 className="font-headline text-3xl font-semibold tracking-tight sm:text-4xl">
          Page not found
        </h1>
        <p className="max-w-prose text-base leading-7 text-on-surface-variant">
          This page doesn't exist. Your account settings are one click away.
        </p>
        <Button asChild variant="cta" size="lg">
          <a href="/account">Go to my account</a>
        </Button>
      </div>
    </AccountShell>
  );
}

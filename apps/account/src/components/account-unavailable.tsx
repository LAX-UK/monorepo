import { Button } from "@/components/account-button";
import { AccountShell } from "./account-shell";

/**
 * Shown when the session store cannot be reached. Retry is a plain link back to the same page
 * (the pages are dynamic), so it works without client JavaScript and re-runs the session load.
 */
export function AccountUnavailable({ retryHref }: { retryHref: string }) {
  return (
    <AccountShell>
      <div className="flex w-full flex-col items-start gap-4 py-6">
        <h1 className="font-headline text-3xl font-semibold tracking-tight sm:text-4xl">
          We can't reach your account right now
        </h1>
        <p className="max-w-prose text-base leading-7 text-on-surface-variant">
          You're still signed in. This is a temporary problem on our side, so nothing has been
          changed. Please try again in a moment.
        </p>
        <Button asChild variant="cta" size="lg">
          <a href={retryHref}>Try again</a>
        </Button>
      </div>
    </AccountShell>
  );
}

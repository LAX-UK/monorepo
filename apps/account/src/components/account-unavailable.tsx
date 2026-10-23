import { Button } from "@auction/ui/components/button";
import { AccountShell } from "./account-shell";

/**
 * Shown when the session store cannot be reached. Retry is a plain link back to the same page
 * (the pages are dynamic), so it works without client JavaScript and re-runs the session load.
 */
export function AccountUnavailable({ retryHref }: { retryHref: string }) {
  return (
    <AccountShell>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-10">
        <h1 className="font-headline text-2xl font-semibold tracking-tight">
          We can't reach your account right now
        </h1>
        <p className="text-sm leading-6 text-on-surface-variant">
          You're still signed in. This is a temporary problem on our side, so nothing has been
          changed. Please try again in a moment.
        </p>
        <Button asChild variant="cta" size="lg">
          <a href={retryHref}>Retry</a>
        </Button>
      </div>
    </AccountShell>
  );
}

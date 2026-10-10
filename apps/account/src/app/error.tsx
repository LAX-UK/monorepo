"use client";

import { AccountShell, primaryButton, textLink } from "@/components/account-ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <AccountShell>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-10" role="alert">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-on-surface-variant">
          We couldn't load your account just now. Please try again in a moment.
        </p>
        <button type="button" onClick={reset} className={primaryButton}>
          Try again
        </button>
        <a href="/" className={textLink}>
          Back to sign in
        </a>
      </div>
    </AccountShell>
  );
}

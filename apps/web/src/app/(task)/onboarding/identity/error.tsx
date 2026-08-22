"use client";

import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export default function IdentityOnboardingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-headline text-2xl font-semibold text-on-surface">
        Verification setup is temporarily unavailable
      </h1>
      <p className="font-body text-sm leading-6 text-on-surface-variant">
        Your progress is safe. Try loading this step again, or return to your dashboard.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Return to dashboard</Link>
        </Button>
      </div>
    </section>
  );
}

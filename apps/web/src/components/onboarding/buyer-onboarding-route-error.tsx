"use client";

import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type BuyerOnboardingRouteErrorProps = {
  title: string;
  detail: string;
  reset: () => void;
};

export function BuyerOnboardingRouteError({
  title,
  detail,
  reset,
}: BuyerOnboardingRouteErrorProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-headline text-2xl font-semibold text-on-surface">{title}</h1>
      <p className="font-body text-sm leading-6 text-on-surface-variant">{detail}</p>
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

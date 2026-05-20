"use client";

import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  title?: string;
  message?: string;
  reset?: () => void;
  homeHref?: string;
  homeLabel?: string;
};

/** Shared admin route error boundary UI. */
export function AdminErrorPage({
  title = "Admin hiccup",
  message = "Something went wrong loading this page. Try again or return to the dashboard.",
  reset,
  homeHref = "/admin",
  homeLabel = "Back to admin home",
}: Props) {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center"
      role="alert"
    >
      <h1 className="font-display text-2xl text-on-surface">{title}</h1>
      <p className="max-w-md font-body text-sm text-on-surface-variant">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {reset ? (
          <Button type="button" variant="default" onClick={reset}>
            Try again
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

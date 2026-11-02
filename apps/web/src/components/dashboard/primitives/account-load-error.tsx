"use client";

import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { Button } from "@auction/ui/components/button";
import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export const CLIENT_SERVICES_HREF = "/contact";

export type AccountLoadErrorProps = {
  /** Names what failed: "We couldn't load your bids". */
  title: string;
  /** Says it is on our side and what is still safe. */
  description: string;
  /** Tries again; reloads the page's data when not given. */
  onRetry?: () => void;
  /** Tries again by opening this address (a download or a route) instead of reloading the page. */
  retryHref?: string;
  /** `h1` when the failure is the whole page, so the page still has its one main heading. */
  headingLevel?: "h1" | "h2";
};

/**
 * An account page whose list did not load: the askew frame, a calm sentence that it is on our
 * side, "Try again" and a way to reach client services. The same drawing and layout as the
 * empty states, so failure never looks like a broken page.
 */
export function AccountLoadError({
  title,
  description,
  onRetry,
  retryHref,
  headingLevel = "h2",
}: AccountLoadErrorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const retry = onRetry ?? (() => startTransition(() => router.refresh()));
  return (
    <div role="alert">
      <DashboardEmptyState
        variant="hero"
        headingLevel={headingLevel}
        illustration="error"
        title={title}
        description={description}
        action={
          <>
            {retryHref ? (
              <Button variant="primary" asChild>
                {/* A plain link: the address answers with a file or a redirect, not a page. */}
                <a href={retryHref}>
                  <RotateCw aria-hidden />
                  Try again
                </a>
              </Button>
            ) : (
              <Button type="button" variant="primary" onClick={retry} disabled={pending}>
                <RotateCw
                  aria-hidden
                  className={pending ? "motion-safe:animate-spin" : undefined}
                />
                {pending ? "Trying again…" : "Try again"}
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link href={CLIENT_SERVICES_HREF}>Contact client services</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}

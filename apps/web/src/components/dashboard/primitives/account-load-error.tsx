"use client";

import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { Button } from "@auction/ui/lax";
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
};

/**
 * An account page whose list did not load: the askew frame, a calm sentence that it is on our
 * side, "Try again" and a way to reach client services. The same drawing and layout as the
 * empty states, so failure never looks like a broken page.
 */
export function AccountLoadError({ title, description, onRetry }: AccountLoadErrorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const retry = onRetry ?? (() => startTransition(() => router.refresh()));
  return (
    <div role="alert">
      <DashboardEmptyState
        variant="hero"
        illustration="error"
        title={title}
        description={description}
        action={
          <>
            <Button type="button" variant="primary" onClick={retry} disabled={pending}>
              <RotateCw aria-hidden className={pending ? "motion-safe:animate-spin" : undefined} />
              {pending ? "Trying again…" : "Try again"}
            </Button>
            <Button variant="ghost" asChild>
              <Link href={CLIENT_SERVICES_HREF}>Contact client services</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}

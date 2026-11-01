"use client";

import { LotPageMessage } from "@/components/lot-page/lot-page-message";
import { useReportRouteError } from "@/lib/observability/use-report-route-error";
import { Button, ButtonLink, EmptyState } from "@auction/ui/lax";
import { RefreshCw } from "lucide-react";
import Link from "next/link";

/** The lot could not be loaded: our side, nothing lost. Try again, or go back to the sales. */
export default function LotError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportRouteError(error);
  return (
    <LotPageMessage>
      <EmptyState
        illustration="frame"
        title="We couldn't load this lot"
        description="This is on our side. Your bids are safe. Try again in a moment."
        actions={
          <>
            <Button variant="primary" icon={<RefreshCw aria-hidden />} onClick={() => reset()}>
              Try again
            </Button>
            <ButtonLink href="/sales" Link={Link} variant="secondary">
              Current auctions
            </ButtonLink>
          </>
        }
      />
    </LotPageMessage>
  );
}

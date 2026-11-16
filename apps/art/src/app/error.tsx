"use client";

import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingStatusAction } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { EmptyState } from "@auction/ui/lax/empty-state";

export default function ArtRouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
      <EmptyState
        variant="error"
        layout="page"
        illustration="askew"
        title="Something went wrong"
        description="We could not load this page. Try again, or come back shortly."
        actions={
          <MarketingStatusAction priority="primary" onClick={reset}>
            Try again
          </MarketingStatusAction>
        }
      />
    </div>
  );
}

"use client";

import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingStatusAction } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { askew } from "@auction/ui/lax/drawings";
import { EmptyStateBase } from "@auction/ui/lax/empty-state-base";

export default function ArtRouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
      <EmptyStateBase
        accent
        variant="error"
        layout="page"
        drawing={{ name: "askew", paths: askew }}
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

"use client";

import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingStatusAction, MarketingStatusState } from "@auction/marketing-ui";
import { cn } from "@auction/ui";

export default function ArtRouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
      <MarketingStatusState
        variant="error"
        layout="page"
        motif="alert"
        titleAs="h1"
        announcement="assertive"
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

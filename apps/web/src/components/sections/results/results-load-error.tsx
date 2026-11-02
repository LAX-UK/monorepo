import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";

/** A failed load, which must not read as "no results". The cause is logged, never shown. */
export function ResultsLoadError({ retryHref }: { retryHref: string }) {
  return (
    <MarketingEmptyState
      variant="marketing"
      context="error"
      title="Results temporarily unavailable"
      description="We couldn’t load results. Try again in a moment."
      action={
        <>
          <ButtonLink Link={Link} variant="primary" href={retryHref}>
            Try again
          </ButtonLink>
          <ButtonLink Link={Link} variant="secondary" href="/">
            Back to home
          </ButtonLink>
        </>
      }
    />
  );
}

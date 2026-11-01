import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";

/** Shared empty state for artist profile works sections. */
export function ArtistWorksEmptyState() {
  return (
    <MarketingEmptyState
      variant="panel"
      context="noResults"
      illustration="lots"
      title="No public lots yet"
      description={
        <>
          This profile has no listed works right now. Browse{" "}
          <Link href="/sales" className="text-link underline-offset-4 hover:underline">
            live salerooms
          </Link>{" "}
          or check back later.
        </>
      }
      action={
        <ButtonLink Link={Link} variant="secondary" href="/search">
          Search lots
        </ButtonLink>
      }
    />
  );
}

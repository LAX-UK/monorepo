import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { Button } from "@auction/ui";
import Link from "next/link";

/** Shared empty state for artist profile works sections. */
export function ArtistWorksEmptyState() {
  return (
    <MarketingEmptyState
      variant="panel"
      title="No public lots yet"
      description={
        <>
          This profile has no listed works right now. Browse{" "}
          <Link href="/sales" className="text-primary underline-offset-4 hover:underline">
            live salerooms
          </Link>{" "}
          or check back later.
        </>
      }
      action={
        <Button variant="outline" asChild>
          <Link href="/search">Search lots</Link>
        </Button>
      }
    />
  );
}

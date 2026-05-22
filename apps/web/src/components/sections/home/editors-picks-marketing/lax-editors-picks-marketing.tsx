import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import type { EditorsPickLotCardVM } from "@/components/sections/home/home-view-models";
import { Button } from "@auction/ui";
import Link from "next/link";
import { EditorsPicksMarketingClient } from "./editors-picks-marketing-client";

type Props = {
  lots: EditorsPickLotCardVM[];
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath?: string;
};

/** Server entry for the home “Editor’s Picks” strip; interactivity lives in the client layer. */
export function LaxEditorsPicksMarketing({
  lots,
  isAuthenticated,
  watchedLotIds,
  loginNextPath = "/",
}: Props) {
  if (lots.length === 0) {
    return (
      <section
        aria-labelledby="home-editors-picks-heading"
        className="mx-auto w-full max-w-[var(--container-max,1440px)] px-8 pb-0 pt-10 md:px-10 lg:px-14"
      >
        <MarketingEmptyState
          variant="marketing"
          title="Editor's picks coming soon"
          description="Our specialists are curating highlights for this section."
          action={
            <Button variant="outline" asChild>
              <Link href="/search">Browse all lots</Link>
            </Button>
          }
        />
      </section>
    );
  }
  return (
    <EditorsPicksMarketingClient
      lots={lots}
      isAuthenticated={isAuthenticated}
      watchedLotIds={watchedLotIds}
      loginNextPath={loginNextPath}
    />
  );
}

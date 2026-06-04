import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import type { EditorsPickLotCardVM } from "@/components/sections/home/home-view-models";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
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
        aria-label="Editor's picks"
        className={`${MARKETING_PAGE_SHELL} pb-0 pt-[var(--section-spacing-tight)]`}
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

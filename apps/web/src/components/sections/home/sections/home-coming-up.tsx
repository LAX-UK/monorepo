import { MarketingSection } from "@/components/marketing/marketing-section";
import type { HomeComingUp } from "@/lib/home-sections/types";
import { cn } from "@auction/ui";
import { HomeSaleCard } from "./home-sale-card";

/**
 * The sales still to come as cards with their cover: one sale is a wide feature card, two or
 * three are a row. The plain dated list lives on the Auction calendar page.
 */
export function HomeComingUpSection({
  comingUp,
  signedIn = false,
}: {
  comingUp: HomeComingUp;
  signedIn?: boolean;
}) {
  const feature = comingUp.layout === "feature";
  return (
    <MarketingSection id="home-coming-up" heading="Coming up" action={comingUp.seeAll}>
      <ul
        className={cn(
          "m-0 grid list-none gap-4 p-0 md:gap-6",
          !feature && (comingUp.rows.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"),
        )}
      >
        {comingUp.rows.map((row) => (
          <li key={row.id} className="min-w-0">
            <HomeSaleCard row={row} variant={comingUp.layout} signedIn={signedIn} />
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}

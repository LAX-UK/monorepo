import { CatalogueGrid } from "@/components/catalogue-grid";
import { ArtistCard } from "@/components/home/cards/artist-card";
import { ShopCatalogueState } from "@/components/home/shop-empty-state";
import { ShopSectionHeader } from "@/components/home/shop-section-header";
import type { HomeEditionStepVm, HomePageViewModel } from "@/lib/home/home-page.vm";
import {
  MarketingCertificateIcon,
  MarketingCheckIcon,
  MarketingGridIcon,
  MarketingTruckIcon,
} from "@auction/marketing-ui";

export function NewEditionsSection({
  editions,
  errorMessage,
}: {
  editions: HomePageViewModel["editions"];
  errorMessage?: string | undefined;
}) {
  if (editions.length === 0 && !errorMessage) return null;
  return (
    <section className="shop-home__section" aria-labelledby="home-editions-heading">
      <ShopSectionHeader
        headingId="home-editions-heading"
        title="New editions"
        subtitle="On sale now"
        actionLabel="View all"
        actionHref="/artworks?availability=available"
      />
      {editions.length > 0 ? (
        <CatalogueGrid items={editions} titleLevel={3} className="shop-home__grid" />
      ) : (
        <ShopCatalogueState
          variant="error"
          title="New editions are unavailable right now"
          description="We could not load the newest editions. Try again, or browse the catalogue."
          browseHref="/artworks"
          browseLabel="Browse editions"
        />
      )}
    </section>
  );
}

export function HomeArtistsSection({ artists }: { artists: HomePageViewModel["artists"] }) {
  if (artists.length === 0) return null;
  return (
    <section className="shop-home__section" aria-labelledby="home-artists-heading">
      <ShopSectionHeader
        headingId="home-artists-heading"
        title="Artists with editions"
        actionLabel="All artists"
        actionHref="/artists"
      />
      <ul className="shop-catalogue__list shop-home__grid">
        {artists.map((card) => (
          <li key={card.id}>
            <ArtistCard card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEP_ICONS: Record<HomeEditionStepVm["id"], typeof MarketingGridIcon> = {
  size: MarketingGridIcon,
  number: MarketingCheckIcon,
  certificate: MarketingCertificateIcon,
  delivery: MarketingTruckIcon,
};

export function HowEditionsWorkSection({ steps }: { steps: HomeEditionStepVm[] }) {
  return (
    <section
      className="shop-home__section shop-home__section--steps"
      aria-labelledby="home-steps-heading"
    >
      <ShopSectionHeader headingId="home-steps-heading" title="How editions work" />
      <ul className="shop-home-steps">
        {steps.map((step) => {
          const Icon = STEP_ICONS[step.id];
          return (
            <li key={step.id} className="shop-home-steps__item">
              <Icon className="shop-home-steps__icon" />
              <h3 className="shop-home-steps__title">{step.title}</h3>
              <p className="shop-home-steps__body">{step.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

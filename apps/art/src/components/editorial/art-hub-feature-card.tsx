import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { HubFeatureCardVm } from "@/lib/editorial/hub-card.vm";
import { MarketingFeatureCard } from "@auction/marketing-ui";

/** Maps a Collector Hub placement onto the shared split card; CMS links stay safe-checked. */
export function ArtHubFeatureCard({
  card,
  priority = false,
}: {
  card: HubFeatureCardVm;
  priority?: boolean;
}) {
  return (
    <MarketingFeatureCard
      data-testid="art-hub-card"
      title={card.title}
      href={card.href}
      linkAs={ArtEditorialLink}
      {...(card.body ? { body: card.body } : {})}
      {...(card.ctaLabel ? { ctaLabel: card.ctaLabel } : {})}
      media={
        <ArtMediaImage
          src={card.imageUrl}
          alt=""
          label="Collector Hub"
          sizes="(min-width: 64rem) 25vw, (min-width: 48rem) 45vw, 100vw"
          priority={priority}
          className="absolute inset-0 size-full"
          imgClassName="object-cover"
        />
      }
    />
  );
}

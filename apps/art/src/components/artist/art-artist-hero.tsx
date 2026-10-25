import { ArtArtistFollowButton } from "@/components/favorites/art-artist-follow-button.client";
import { ArtHeroSignal } from "@/components/header/art-hero-signal.client";
import type { ArtistPageVm } from "@/lib/artist/artist-page.composer";
import { ART_HERO_UNDER_HEADER_CLASS } from "@/lib/layout/art-header-chrome.vm";
import {
  MarketingArtistCrossLinks,
  MarketingArtistFacts,
  MarketingArtistHero,
  MarketingShareButton,
  marketingArtistFacts,
} from "@auction/marketing-ui";

/** Keeps outline controls legible on the hero scrim by borrowing the band's foreground. */
const ON_MEDIA_CONTROL =
  "border-current bg-transparent text-inherit hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] hover:text-inherit aria-pressed:border-transparent aria-pressed:bg-[var(--color-hero-foreground)] aria-pressed:text-on-surface";

/**
 * Figma artist hero (`439:6125`) on the shared artist hero's band variant: discipline, name,
 * nationality and life span, outline Follow and Share, and "Editions in LAX Shop" when the
 * Shop has editions. Full-bleed over the hero image when there is one, plain otherwise.
 */
export function ArtArtistHero({ vm, pageUrl }: { vm: ArtistPageVm; pageUrl: string }) {
  const onMedia = Boolean(vm.heroUrl);
  return (
    <>
      {onMedia ? <ArtHeroSignal /> : null}
      <MarketingArtistHero
        variant="band"
        name={vm.name}
        eyebrow={vm.discipline}
        {...(vm.heroUrl
          ? {
              backdrop: { src: vm.heroUrl, priority: true },
              className: ART_HERO_UNDER_HEADER_CLASS,
            }
          : {})}
        facts={
          <MarketingArtistFacts
            size="band"
            facts={marketingArtistFacts({ ...vm.facts, discipline: null })}
          />
        }
        actions={
          <>
            <ArtArtistFollowButton
              slug={vm.slug}
              name={vm.name}
              initialFollowing={vm.following}
              auth={vm.favoriteAuth}
              {...(onMedia ? { className: ON_MEDIA_CONTROL } : {})}
            />
            <MarketingShareButton
              url={pageUrl}
              title={vm.name}
              className={onMedia ? ON_MEDIA_CONTROL : "min-h-11"}
            />
          </>
        }
        crossLinks={<MarketingArtistCrossLinks links={vm.crossLinks} />}
      />
    </>
  );
}

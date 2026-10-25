import { ArtArtistFollowButton } from "@/components/favorites/art-artist-follow-button.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ArtistPageVm } from "@/lib/artist/artist-page.composer";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import {
  MarketingArtistCrossLinks,
  MarketingArtistFacts,
  MarketingArtistHero,
  MarketingShareButton,
  marketingArtistFacts,
} from "@auction/marketing-ui";

/**
 * The shared LAX artist hero (as on LAX Bid and LAX Shop): portrait on a mat, name, nationality,
 * life span and discipline, Follow, Share and, when the Shop has editions, a link to them. The
 * biography keeps its own section below.
 */
export function ArtArtistHero({ vm, pageUrl }: { vm: ArtistPageVm; pageUrl: string }) {
  const portrait = vm.portraitUrl ?? vm.heroUrl;
  return (
    <MarketingArtistHero
      name={vm.name}
      facts={<MarketingArtistFacts facts={marketingArtistFacts(vm.facts)} />}
      actions={
        <>
          <ArtArtistFollowButton
            slug={vm.slug}
            name={vm.name}
            initialFollowing={vm.following}
            auth={vm.favoriteAuth}
            className="min-h-11 min-w-24 px-5 text-sm font-medium normal-case tracking-normal"
          />
          <MarketingShareButton url={pageUrl} title={vm.name} />
        </>
      }
      crossLinks={<MarketingArtistCrossLinks links={vm.crossLinks} />}
      portrait={
        portrait ? (
          <ArtMediaImage
            src={portrait}
            alt={vm.portraitAlt}
            label={ART_MEDIA_LABELS.artistPortrait}
            aspect={[4, 5]}
            sizes="(min-width: 48rem) 40vw, 18rem"
            priority
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        ) : null
      }
    />
  );
}

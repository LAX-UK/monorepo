import { ArtArtistFollowButton } from "@/components/favorites/art-artist-follow-button.client";
import { ArtMediaPageTitle } from "@/components/layout/art-media-page-title";
import type { ArtistPageVm } from "@/lib/artist/artist-page.composer";
import { MarketingPageTitle } from "@auction/marketing-ui";

/** Keeps the outline Follow legible on the hero scrim by borrowing the band's foreground. */
const ON_MEDIA_FOLLOW =
  "border-current bg-transparent text-inherit hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] hover:text-inherit aria-pressed:border-transparent aria-pressed:bg-[var(--color-hero-foreground)] aria-pressed:text-on-surface";

/** Figma artist hero (`439:6125`): name, nationality and life span, and an outline Follow. */
export function ArtArtistHero({ vm }: { vm: ArtistPageVm }) {
  const content = {
    title: vm.name,
    eyebrow: vm.discipline,
    subtitle: vm.lifeLine,
    actions: (
      <ArtArtistFollowButton
        slug={vm.slug}
        name={vm.name}
        initialFollowing={vm.following}
        auth={vm.favoriteAuth}
        {...(vm.heroUrl ? { className: ON_MEDIA_FOLLOW } : {})}
      />
    ),
  };
  return vm.heroUrl ? (
    <ArtMediaPageTitle variant="media" image={{ src: vm.heroUrl }} priority {...content} />
  ) : (
    <MarketingPageTitle {...content} />
  );
}

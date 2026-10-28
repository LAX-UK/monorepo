import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import type { GalleryTeamVm } from "@/lib/gallery-team/gallery-team.vm";
import { MarketingGalleryTeamBand } from "@auction/marketing-ui";

/**
 * The shared gallery team band on Shop: the same photograph, reply note and four details as
 * lax.art, with one outline action into help and contact.
 */
export function ShopGalleryTeamBand({ team }: { team: GalleryTeamVm }) {
  return (
    <MarketingGalleryTeamBand
      className="shop-gallery-team"
      eyebrow={team.eyebrow}
      title={team.title}
      body={team.body}
      note={team.note}
      details={team.details}
      data-testid="shop-gallery-team-band"
      media={
        <ShopMediaImage
          src={team.imageUrl}
          alt=""
          sizes="(min-width: 48rem) 40vw, 100vw"
          className="absolute inset-0 size-full"
          imgClassName="object-cover"
        />
      }
      actions={
        // On phones the one action spans the panel, so it is easy to reach with a thumb.
        <ShopCommerceButton
          variant="outline"
          scale="standard"
          href={team.action.href}
          className="w-full sm:w-fit"
        >
          {team.action.label}
        </ShopCommerceButton>
      }
    />
  );
}

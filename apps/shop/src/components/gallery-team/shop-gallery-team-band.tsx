import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import type { GalleryTeamVm } from "@/lib/gallery-team/gallery-team.vm";
import {
  MarketingGalleryTeamBand,
  MarketingMailIcon,
  MarketingPhoneIcon,
} from "@auction/marketing-ui";

/** The shared gallery team band, with Shop's own secondary buttons for the phone and email. */
export function ShopGalleryTeamBand({ team }: { team: GalleryTeamVm }) {
  return (
    <MarketingGalleryTeamBand
      className="shop-gallery-team"
      eyebrow={team.eyebrow}
      title={team.title}
      body={team.body}
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
        <>
          <ShopCommerceButton variant="outline" scale="standard" href={team.phone.href}>
            <MarketingPhoneIcon className="size-4" />
            {team.phone.label}
          </ShopCommerceButton>
          <ShopCommerceButton variant="outline" scale="standard" href={team.email.href}>
            <MarketingMailIcon className="size-4" />
            {team.email.label}
          </ShopCommerceButton>
        </>
      }
      details={[{ kind: "address", text: team.address }]}
    />
  );
}

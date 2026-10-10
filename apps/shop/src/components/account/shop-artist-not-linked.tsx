import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
} from "@/components/account/shop-account-shell";
import { SITE_SUPPORT_EMAIL } from "@auction/branding";

export const shopArtistNotLinkedNotice = {
  variant: "default" as const,
  title: "No artist profile linked",
  description: "This account isn’t linked to an LAX artist profile yet.",
};

export function ShopArtistNotLinkedActions() {
  return (
    <>
      <ShopAccountBodyText>
        If you’re an artist represented by LAX, contact us from this email address and we’ll link
        your profile so you can see your artworks and sales here.
      </ShopAccountBodyText>
      <ShopAccountLinkButton
        href={`mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent("Link my artist profile")}`}
        label="Contact support"
      />
      <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
    </>
  );
}

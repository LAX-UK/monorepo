import { SHOP_HELP_CONTACT } from "@/content/policies/help";
import { GALLERY_CONTACT } from "@auction/branding";

/** "Talk to the gallery team", on the home page and every edition page. */
export type GalleryTeamVm = {
  eyebrow: string;
  title: string;
  body: string;
  /** The gallery's direct line, from the same contact details as the help page. */
  phone: { label: string; href: string };
  email: { label: string; href: string };
  address: string;
  /** A bright view of a gallery, shipped with Shop. */
  imageUrl: string;
};

export function buildGalleryTeam(): GalleryTeamVm {
  return {
    eyebrow: "The gallery team",
    title: "Help choosing a size, a frame or a gift",
    body: "Talk to the people who hang these works every day. You are welcome to see editions in person at the gallery.",
    phone: { label: GALLERY_CONTACT.phone, href: GALLERY_CONTACT.phoneHref },
    email: { label: "Email the gallery team", href: SHOP_HELP_CONTACT.emailHref },
    address: SHOP_HELP_CONTACT.address,
    imageUrl: "/shop/home/hero-layer-2.webp",
  };
}

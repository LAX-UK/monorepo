import { SHOP_POLICY_PATHS } from "@/content/policies/shop-policy-status";
import { GALLERY_CONTACT } from "@auction/branding";
import {
  type MarketingGalleryContact,
  type MarketingGalleryTeamDetail,
  marketingGalleryContactDetails,
} from "@auction/marketing-ui";

/** Where the band closes a Shop page; each place has its own invitation. */
export type GalleryTeamContext = "home" | "edition";

/** "Talk to the gallery team", on the home page and every edition page. */
export type GalleryTeamVm = {
  eyebrow: string;
  title: string;
  body: string;
  /** Who replies and how soon, under the action. */
  note: string;
  /** The same view of the gallery as lax.art's band, so both read as one place. */
  imageUrl: string;
  /** Phone, email, address with a map link and, when published, the opening hours. */
  details: MarketingGalleryTeamDetail[];
  /** Shop takes no enquiries, so its one action is the help page. */
  action: { label: string; href: string };
};

const CONTEXTS: Record<GalleryTeamContext, { title: string; body: string }> = {
  home: {
    title: "Help choosing a size, a frame or a gift",
    body: "Talk to the people who hang these works every day. You are welcome to see editions in person at the gallery.",
  },
  edition: {
    title: "Questions about this edition?",
    body: "Ask about the paper, the signature, framing or delivery. The people who hang these works will answer.",
  },
};

const REPLY_PROMISE = "We reply within one working day.";
const GALLERY_IMAGE = "/shop/home/hero-layer-2.webp";

export function buildGalleryTeam(input: {
  context: GalleryTeamContext;
  contact?: MarketingGalleryContact;
}): GalleryTeamVm {
  const copy = CONTEXTS[input.context];
  return {
    eyebrow: "The gallery team",
    title: copy.title,
    body: copy.body,
    note: REPLY_PROMISE,
    imageUrl: GALLERY_IMAGE,
    details: marketingGalleryContactDetails(input.contact ?? GALLERY_CONTACT),
    action: { label: "Help and contact", href: SHOP_POLICY_PATHS.help },
  };
}

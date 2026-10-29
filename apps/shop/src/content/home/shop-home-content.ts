/**
 * The fixed words on the Shop home page. Everything that depends on the catalogue (counts, prices,
 * the release) is worked out in the view model; this is only what the gallery says.
 */
export const SHOP_HOME_CONTENT = {
  hero: {
    title: "Limited-edition prints from our Marylebone gallery",
    primaryLabel: "Browse editions",
    browseByLabel: "Browse by",
    emptyTitle: "New editions are on their way",
    emptyLeadSoldOut:
      "Every edition has found a home for now. The gallery’s artists are preparing the next releases.",
    emptyLeadFirst: "The gallery’s artists are preparing the first releases.",
    emptyArtLabel: "See original works on lax.art",
    emptyHelpLabel: "Ask the gallery",
  },
  newEditions: {
    title: "New editions",
    subtitle: "Released by artists the gallery represents.",
  },
  artists: {
    title: "Artists",
    subtitle: "The gallery’s artists with editions in the Shop.",
    laxArtLabel: "Read their full stories on lax.art",
    soloEyebrow: "The artist",
    profileLabel: "Read the profile on lax.art",
  },
  collections: {
    title: "Start a collection",
    subtitle: "Ways in, chosen from what is on sale.",
  },
  doors: {
    title: "Across LAX",
    description: "Original works and live auctions from the gallery’s family.",
    art: {
      title: "Original works and the artists’ stories",
      promise: "Originals, exhibitions and full artist profiles, from our Marylebone gallery.",
      actionLabel: "Visit lax.art",
      /** lax.art has no door illustration yet, so Shop shows a view of the gallery. */
      imageUrl: "/shop/home/hero-layer-3.webp",
    },
    bid: {
      title: "Art and collectibles at auction",
      promise: "Live and timed sales you can follow and bid in from anywhere.",
      actionLabel: "Visit LAX Bid",
    },
  },
} as const;

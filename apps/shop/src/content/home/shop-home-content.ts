/**
 * The fixed words on the Shop home page. Everything that depends on the catalogue (counts, prices,
 * the release) is worked out in the view model; this is only what the gallery says.
 */
export const SHOP_HOME_CONTENT = {
  hero: {
    title: "Limited editions by our gallery artists",
    primaryLabel: "Browse editions",
  },
  newEditions: {
    title: "New editions",
    subtitle: "The newest editions on sale now.",
  },
  story: { eyebrow: "Behind the edition" },
  artists: {
    title: "Artists with editions",
    subtitle: "The artists behind the editions.",
    laxArtLabel: "Their full stories are on lax.art",
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

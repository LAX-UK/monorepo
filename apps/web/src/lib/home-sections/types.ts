import type { HomeSectionId } from "@auction/domain";

export type HomeLink = { href: string; label: string };

/** One work on a home card: what the shared work card prints, as plain data. */
export type HomeLotCard = {
  id: string;
  href: string;
  title: string;
  artistName: string | null;
  imageUrl: string | null;
  /** "Lot 4", then the estimate while the lot is not yet sold. */
  details: string[];
  /** "Sold for £7,750", "Current bid £6,250"; null when the lot has no price to show. */
  price: { qualifier: string | null; value: string } | null;
};

export type HomeLotRail = {
  heading: string;
  subtitle: string;
  seeAll: HomeLink;
  lots: HomeLotCard[];
};

export type HomeComingUpRow = {
  id: string;
  href: string;
  /** "10 Nov", or "Mar 2027" for a sale that is far off. */
  dateMain: string;
  /** "Tue · 18:00 GMT", or "Opens Tue 9 Mar". */
  dateSub: string;
  title: string;
  /** "In the room, London · 6 lots". */
  meta: string;
  action: HomeLink;
};

export type HomeComingUp = { rows: HomeComingUpRow[]; seeAll: HomeLink };

export type HomeResultsFacts = {
  saleTitle: string;
  /** "Ended Thu 15 Oct · online". */
  endedLabel: string;
  sold: { value: string; note: string };
  total: { value: string; note: string };
  topLot: { value: string; note: string | null } | null;
};

export type HomeResultsBand = {
  subtitle: string;
  seeAll: HomeLink;
  facts: HomeResultsFacts;
  lots: HomeLotCard[];
};

export type HomeDepartment = { id: string; name: string; href: string; imageUrl: string | null };

export type HomeArtistCard = {
  id: string;
  name: string;
  href: string;
  facts: string | null;
  caption: string | null;
  portraitUrl: string | null;
  workImageUrl: string | null;
};

export type HomeSelling = {
  /** "Consignments for Spring Modern British close Fri 15 Jan"; null when no deadline is set. */
  deadlineNote: string | null;
  /** Two works from recent results shown beside the copy. */
  imageUrls: string[];
};

export type HomePressItem = {
  id: string;
  href: string;
  label: string;
  headline: string;
};

/** Every home section below the hero that has something to show; a missing key is hidden. */
export type HomeSections = {
  inThisSale?: HomeLotRail;
  highlightsFromNextSale?: HomeLotRail;
  topLotsOfSale?: HomeLotRail;
  comingUp?: HomeComingUp;
  recentResults?: HomeResultsBand;
  departments?: HomeDepartment[];
  artists?: HomeArtistCard[];
  selling?: HomeSelling;
  alerts?: true;
  fromLaxAndPress?: HomePressItem[];
};

export type HomeSectionKey = keyof HomeSections & HomeSectionId;

import type { LotCardLineModel } from "@/lib/lot-card/lot-card-line";
import type { HomeSectionId } from "@auction/domain";

export type HomeLink = { href: string; label: string };

/** One work on a home card: what the shared work card prints, as plain data. */
export type HomeLotCard = {
  id: string;
  href: string;
  title: string;
  artistName: string | null;
  imageUrl: string | null;
  /** Whether a person can still follow the lot: it is live or coming up, not sold or ended. */
  watchable: boolean;
  /** "Lot 4". */
  details: string[];
  /** "Estimate £4,000 – £6,000"; null when staff set none. */
  estimate: string | null;
  /** The price and clock the card prints: the same line as every other lot card. */
  line: LotCardLineModel;
};

export type HomeLotRail = {
  heading: string;
  subtitle: string;
  seeAll: HomeLink;
  lots: HomeLotCard[];
};

/** A sale's staff-chosen cover as a card shows it: the file and the point that stays in frame. */
export type HomeCardImage = { src: string; alt: string; focal: { x: number; y: number } };

/** The line under the date: static text, counting every second in the final hour. */
export type HomeComingUpTime = { text: string; tick?: { endsAt: string; template: string } };

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
  /** How the sale is held: "Online", "In the room, London". */
  typeLabel: string;
  /** "6 lots"; null while the catalogue is empty. */
  lotsLabel: string | null;
  /** The sale's cover; null when staff set none, and the card then stands on plain surface. */
  image: HomeCardImage | null;
  /** "Opens Tue 10 Nov, 18:00 GMT · in 2 days"; null when the sale has no start. */
  time: HomeComingUpTime | null;
  action: HomeLink;
};

/** One sale is a wide feature card; two or three are a row of cards. */
export type HomeComingUpLayout = "feature" | "row";

export type HomeComingUp = {
  rows: HomeComingUpRow[];
  layout: HomeComingUpLayout;
  seeAll: HomeLink;
};

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
/** The alerts panel: a few works from recent sales shown beside the sign-up. */
export type HomeAlertThumbnail = { src: string };
export type HomeAlerts = { thumbnails: HomeAlertThumbnail[] };

export type HomeSections = {
  inThisSale?: HomeLotRail;
  highlightsFromNextSale?: HomeLotRail;
  topLotsOfSale?: HomeLotRail;
  comingUp?: HomeComingUp;
  recentResults?: HomeResultsBand;
  departments?: HomeDepartment[];
  artists?: HomeArtistCard[];
  selling?: HomeSelling;
  alerts?: HomeAlerts;
  fromLaxAndPress?: HomePressItem[];
};

export type HomeSectionKey = keyof HomeSections & HomeSectionId;

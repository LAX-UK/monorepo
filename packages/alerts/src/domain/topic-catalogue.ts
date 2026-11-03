import type { AlertTopic } from "./products.js";

/** How a topic reads in an email and in the settings that switch it. */
export type TopicDefinition = {
  /** Ordering inside a digest and the lead of its subject: the highest comes first. */
  priority: number;
  /** The heading above a topic's items in a digest. */
  heading: string;
  /** The topic in a list of topics: "new sales", "artists you follow", "saved searches". */
  listName: string;
  /** The topic as a modifier: "Only stop saved search emails". */
  shortName: string;
  /** "sale" or "lot": what one item is called, for subjects and counts. */
  noun: { one: string; many: string };
  /** Subject line when the digest holds exactly one item of this topic. */
  subjectForOne: (title: string) => string;
  /** Subject line when the digest holds several items of this topic. */
  subjectForMany: (count: number) => string;
  /** The wording beside a sign-up form, stored as proof of consent. */
  consentText: string;
  /** What "Stop ..." says in the footer of an email that holds only this topic. */
  stopLabel: string;
  /** The title of a digest led by this topic. */
  digestTitle: (count: number) => string;
  /** Where "See all" goes when a digest lists fewer matches than there are. */
  seeAllPath: string;
};

/**
 * One table for every topic, so a new matcher adds an entry here and nothing else in the engine
 * changes. Wording follows the product it belongs to.
 */
export const TOPIC_CATALOGUE: Readonly<Record<AlertTopic, TopicDefinition>> = {
  "bid.new_sales": {
    listName: "new sales",
    shortName: "new sale",
    priority: 100,
    heading: "New sales",
    noun: { one: "sale", many: "sales" },
    subjectForOne: (title) => `New sale: ${title}`,
    subjectForMany: (count) => `${count} new sales on LAX Bid`,
    consentText:
      "We'll email you when LAX Bid announces a new sale. At most one email a day. You can stop at any time.",
    stopLabel: "Stop sale alerts to this address",
    digestTitle: (count) => (count === 1 ? "A new sale" : `${count} new sales`),
    seeAllPath: "/sales",
  },
  "bid.artists": {
    listName: "artists you follow",
    shortName: "followed artist",
    priority: 60,
    heading: "Artists you follow",
    noun: { one: "lot", many: "lots" },
    subjectForOne: (title) => `New lot by an artist you follow: ${title}`,
    subjectForMany: (count) => `${count} new lots by artists you follow`,
    consentText:
      "We'll email you when a lot comes up for sale by an artist you follow. At most one email a day.",
    stopLabel: "Stop these emails",
    digestTitle: () => "New lots by artists you follow",
    seeAllPath: "/watching",
  },
  "bid.searches": {
    listName: "saved searches",
    shortName: "saved search",
    priority: 40,
    heading: "Your saved searches",
    noun: { one: "lot", many: "lots" },
    subjectForOne: (title) => `A lot matches your saved search: ${title}`,
    subjectForMany: (count) => `${count} lots match your saved searches`,
    consentText:
      "We'll email you when a new lot matches a search you saved. At most one email a day.",
    stopLabel: "Stop these emails",
    digestTitle: () => "Lots that match your saved searches",
    seeAllPath: "/watching",
  },
  "shop.releases": {
    listName: "new editions",
    shortName: "release",
    priority: 100,
    heading: "New editions",
    noun: { one: "edition", many: "editions" },
    subjectForOne: (title) => `New edition: ${title}`,
    subjectForMany: (count) => `${count} new editions in LAX Shop`,
    consentText:
      "We'll email you when LAX Shop releases new editions. At most one email a day. You can stop at any time.",
    stopLabel: "Stop release alerts",
    digestTitle: (count) => (count === 1 ? "A new edition" : `${count} new editions`),
    seeAllPath: "/",
  },
  "shop.back_in_stock": {
    listName: "back in stock",
    shortName: "back in stock",
    priority: 90,
    heading: "Back in stock",
    noun: { one: "edition", many: "editions" },
    subjectForOne: (title) => `Back in stock: ${title}`,
    subjectForMany: (count) => `${count} editions are back in stock`,
    consentText: "You pressed Notify me on an edition. We'll email you once when it is available.",
    stopLabel: "Stop LAX Shop alerts to this address",
    digestTitle: (count) =>
      count === 1 ? "An edition is back in stock" : "Editions are back in stock",
    seeAllPath: "/",
  },
  "art.followed_artists": {
    listName: "artists you follow",
    shortName: "followed artist",
    priority: 80,
    heading: "Artists you follow",
    noun: { one: "work", many: "works" },
    subjectForOne: (title) => `New work: ${title}`,
    subjectForMany: (count) => `${count} new works by artists you follow`,
    consentText:
      "You follow an artist on lax.art. We'll email you when new works arrive. At most one email a day.",
    stopLabel: "Stop these emails",
    digestTitle: () => "New work by artists you follow",
    seeAllPath: "/artists",
  },
};

/**
 * Fixed ids for the rows the staff queue seeders write, so running the seed again updates the same
 * rows. Each group has its own prefix, apart from the ids the top-up and full seeds use.
 */
const id = (group: string, n: number) =>
  `${group}-0000-4000-8000-${n.toString().padStart(12, "0")}`;

export const QUEUE_IDS = {
  venue: (n: number) => id("df910000", n),
  storageTerms: (n: number) => id("df920000", n),
  booking: (n: number) => id("df930000", n),
  purchaseProblem: (n: number) => id("df940000", n),
  purchaseProblemNote: (n: number) => id("df950000", n),
  submission: (n: number) => id("df960000", n),
  privateSaleDeal: (n: number) => id("df970000", n),
  privateSaleParty: (n: number) => id("df980000", n),
  disputeCase: (n: number) => id("df990000", n),
  dataExport: (n: number) => id("df9a0000", n),
  quarantine: (n: number) => id("df9b0000", n),
} as const;

/** Existing demo rows the seeders attach their items to (see the top-up catalogue). */
export const QUEUE_ANCHORS = {
  /** Paid lots, bought by Charlotte Hayes and Northbank Gallery. */
  paidLotInTransit: 21,
  paidLotForCollection: 28,
  paidLotForBooking: 25,
  /** The two ended sales those lots belong to. */
  collectionSales: [4, 5],
  disputedLot: 22,
} as const;

/** The address the demo collection point is given: an invented, clearly fake one. */
export const DEMO_VENUE = {
  name: "LAX Demo Collection Point",
  addressLine1: "1 Example Street",
  city: "London",
  postcode: "EC1A 1AA",
  country: "GB",
  contactEmail: "collections@example.test",
} as const;

/** Days a buyer may leave a paid lot at the demo collection point before storage charges. */
export const DEMO_FREE_STORAGE_DAYS = 14;

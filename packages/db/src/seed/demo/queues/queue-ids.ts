/**
 * Fixed ids for the rows the staff queue seeders own. Every seeder inserts a row only when its id is
 * absent and never changes it afterwards, so running the seed again leaves staff work alone. Each
 * group has its own prefix, apart from the ids the top-up and full seeds use.
 */
const id = (group: string, n: number) =>
  `${group}-0000-4000-8000-${n.toString().padStart(12, "0")}`;

export const QUEUE_IDS = {
  venue: (n: number) => id("df910000", n),
  weeklyHours: (n: number) => id("df920000", n),
  booking: (n: number) => id("df930000", n),
  purchaseProblem: (n: number) => id("df940000", n),
  sale: (n: number) => id("df950000", n),
  submission: (n: number) => id("df960000", n),
  privateSaleDeal: (n: number) => id("df970000", n),
  privateSaleParty: (n: number) => id("df980000", n),
  disputeCase: (n: number) => id("df990000", n),
  dataExport: (n: number) => id("df9a0000", n),
  lot: (n: number) => id("df9b0000", n),
  payment: (n: number) => id("df9c0000", n),
  paymentGroup: (n: number) => id("df9d0000", n),
  fulfilment: (n: number) => id("df9e0000", n),
  enquiry: (n: number) => id("df9f0000", n),
} as const;

/** Existing demo rows a seeder attaches its item to (see the top-up catalogue). Never changed. */
export const QUEUE_ANCHORS = {
  /** A paid lot of the top-up's finished sale, bought by a demo buyer. */
  paidLotInTransit: 21,
} as const;

/** The demo collection point: an invented address on a reserved, never-issued postcode. */
export const DEMO_VENUE = {
  name: "LAX Demo Collection Point",
  slug: "demo-collection-point",
  addressLine1: "1 Example Street",
  city: "London",
  postcode: "ZZ99 9ZZ",
  country: "GB",
  contactEmail: "collections@example.test",
} as const;

/** Stripe-shaped references of the demo's invented payments; none exists at Stripe. */
export const DEMO_STRIPE = {
  bookingIntent: "pi_demo_example_col_0001",
  bookingCharge: "ch_demo_example_col_0001",
  groupIntent: "pi_demo_example_grp_0001",
  groupCharge: "ch_demo_example_0001",
  dispute: "dp_demo_example_0001",
  disputeEvent: "evt_demo_example_dispute_0001",
  customer: "cus_demo_example",
  unappliedEvent: "evt_demo_example_unapplied_0001",
} as const;

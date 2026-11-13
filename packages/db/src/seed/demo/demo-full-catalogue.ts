import { workArtistId } from "./demo-artists.js";
import { COVER_IMAGES, WORKS, type WorkKey } from "./demo-full-works.js";
import { demoImageUrl } from "./demo-images.js";
/**
 * The full demo catalogue, as plain data on top of the top-up: a timed sale that is live now with
 * lots in every department, a saleroom sale in a few days, three more upcoming sales with large
 * cover pictures, and a finished sale with a sold, an unsold, a withdrawn lot and a held invoice.
 * Dates follow the clock reading passed in, so the live sale is live whenever the seed runs.
 *
 * Pure: no database access.
 */
import {
  type DemoBid,
  type DemoCatalogue,
  type DemoFulfilment,
  type DemoLot,
  type DemoPayment,
  type DemoPaymentGroup,
  type DemoRegistration,
  type DemoSale,
  type DemoWatch,
  demoPayment,
} from "./demo-topup-catalogue.js";
import { DEMO_IDS } from "./demo-topup-ids.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type FullActors = {
  collectorUserId: string;
  collectorEntityId: string;
  rivalUserId: string;
  rivalEntityId: string;
  northbankBuyerUserId: string;
  /** Northbank Gallery's owner: wins the one Northbank invoice that is clear to pay. */
  northbankOwnerUserId: string;
  northbankId: string;
  heldUserId: string;
  heldEntityId: string;
  payerUserId: string;
  payerEntityId: string;
  laxStockId: string;
};

type BidderKey = "collector" | "rival" | "northbank" | "northbankOwner" | "held" | "payer";

type LotSpec = {
  work: WorkKey;
  /** The lowest price the seller accepts. Defaults to 80% of the low estimate. */
  reserve?: number;
  /** Bids in the order placed: [who, amount]. The last is the highest. */
  bids?: [BidderKey, number][];
  /** Ended lots only. */
  outcome?: "sold" | "unsold" | "withdrawn";
  /**
   * An invoice still to be paid, raised this many days ago (it is due 7 days after the raise).
   * `transfer` puts it in the one bank transfer that is on its way: its payment is authorised.
   */
  invoice?: { raisedDaysAgo: number; transfer?: boolean };
};

type SaleSpec = {
  key: string;
  n: number;
  title: string;
  description: string;
  cover: string;
  deliveryMode: DemoSale["deliveryMode"];
  status: DemoSale["status"];
  atVenue: boolean;
  categorySlug: string;
  /** Milliseconds from now for the sale's opening, preview and (for sales not timed lot by lot) close. */
  startsIn: number;
  endsIn: number;
  previewFrom: number;
  /** Timed sales close lot by lot from `firstLotCloses`, `lotGap` apart. */
  firstLotCloses?: number;
  lotGap?: number;
  lots: LotSpec[];
};

/** Rounds down to the hour so times read cleanly on the pages. */
const onTheHour = (ms: number): Date => new Date(Math.floor(ms / HOUR) * HOUR);

/** A ladder of bids that alternates between two bidders, for a lot that drew a contest. */
function contest(from: number, step: number, count: number): [BidderKey, number][] {
  const order: BidderKey[] = ["rival", "collector", "northbank"];
  return Array.from({ length: count }, (_, i) => [
    order[i % order.length] as BidderKey,
    from + i * step,
  ]);
}

const SALES: SaleSpec[] = [
  {
    key: "depts",
    n: 11,
    title: "Collectors' Departments: Online",
    description:
      "A timed sale with works from every department: paintings, drawings, photography, sculpture, watches, coins, design, prints and manuscripts. Lots close one by one over the next three days.",
    cover: COVER_IMAGES.depts,
    deliveryMode: "online",
    status: "active",
    atVenue: false,
    categorySlug: "paintings",
    startsIn: -2 * DAY,
    endsIn: 0,
    previewFrom: -6 * DAY,
    firstLotCloses: 20 * HOUR,
    lotGap: 4 * HOUR,
    lots: [
      {
        work: "venice",
        bids: [
          ["rival", 110_000],
          ["collector", 120_000],
          ["northbank", 130_000],
        ],
      },
      {
        work: "threeDancers",
        bids: [
          ["collector", 160_000],
          ["rival", 170_000],
        ],
        reserve: 190_000,
      },
      {
        work: "sete",
        bids: [
          ["collector", 48_000],
          ["rival", 52_000],
        ],
      },
      { work: "ageOfBronze", bids: contest(70_000, 2_000, 14) },
      {
        work: "flowField",
        bids: [
          ["rival", 1_400],
          ["collector", 1_500],
        ],
      },
      {
        work: "creche",
        bids: [
          ["northbank", 3_000],
          ["rival", 3_200],
        ],
      },
      {
        work: "breguet",
        bids: [
          ["rival", 17_000],
          ["collector", 18_000],
        ],
        reserve: 20_000,
      },
      { work: "streamline", bids: [["collector", 900]] },
      {
        work: "stater",
        bids: [
          ["rival", 4_600],
          ["northbank", 5_000],
        ],
      },
      {
        work: "tiffanyLamp",
        bids: [
          ["northbank", 22_000],
          ["collector", 23_000],
        ],
        reserve: 25_000,
      },
      {
        work: "orientalHead",
        bids: [
          ["collector", 7_000],
          ["rival", 7_500],
          ["collector", 8_000],
        ],
      },
      { work: "hardouyn" },
    ],
  },
  {
    key: "room",
    n: 12,
    title: "The Winter Room: Mayfair Live",
    description:
      "An evening sale in the Mayfair saleroom, with bidding in the room, by phone and online. Previews open this week.",
    cover: COVER_IMAGES.degas,
    deliveryMode: "hybrid",
    status: "scheduled",
    atVenue: true,
    categorySlug: "paintings",
    startsIn: 4 * DAY + 5 * HOUR,
    endsIn: 4 * DAY + 10 * HOUR,
    previewFrom: -1 * DAY,
    lots: [
      { work: "berceuse" },
      { work: "argenteuil" },
      { work: "crouchingVenus" },
      { work: "violinist" },
      { work: "perigal" },
      { work: "lastJudgment" },
    ],
  },
  {
    key: "photoPrints",
    n: 13,
    title: "Photographs & Fine Prints",
    description:
      "Nineteenth-century photography and Old Master and Japanese prints, with works by Le Gray, Cameron, Rembrandt, Dürer and Hokusai.",
    cover: COVER_IMAGES.hokusai,
    deliveryMode: "online",
    status: "scheduled",
    atVenue: false,
    categorySlug: "fine-prints",
    startsIn: 26 * DAY,
    endsIn: 33 * DAY,
    previewFrom: 19 * DAY,
    lots: [
      { work: "greatWave" },
      { work: "janLutma" },
      { work: "cardinalAlbrecht" },
      { work: "erasmus" },
      { work: "hiroshige" },
      { work: "vivienMerlin" },
      { work: "muybridge" },
    ],
  },
  {
    key: "designWatches",
    n: 14,
    title: "Design, Watches & Clocks",
    description:
      "Art Nouveau and American art pottery, Tiffany and Bugatti, with English and French clocks and watches from private collections.",
    cover: COVER_IMAGES.manet,
    deliveryMode: "hybrid",
    status: "scheduled",
    atVenue: true,
    categorySlug: "design-decorative-arts",
    startsIn: 48 * DAY,
    endsIn: 49 * DAY,
    previewFrom: 41 * DAY,
    lots: [
      { work: "bugattiTable" },
      { work: "bugattiCabinet" },
      { work: "chelseaVase" },
      { work: "leRoyClock" },
      { work: "brockbank" },
      { work: "roskell" },
    ],
  },
  {
    key: "booksCoins",
    n: 15,
    title: "Books, Manuscripts, Coins & Medals",
    description:
      "Illuminated leaves and a Book of Hours, with Greek, Celtic and Roman coins from private cabinets.",
    cover: COVER_IMAGES.poussin,
    deliveryMode: "online",
    status: "scheduled",
    atVenue: false,
    categorySlug: "books-manuscripts",
    startsIn: 80 * DAY,
    endsIn: 87 * DAY,
    previewFrom: 73 * DAY,
    lots: [
      { work: "leafSaint" },
      { work: "leafHours" },
      { work: "parisii" },
      { work: "denarius" },
      { work: "bronzeHorse" },
      { work: "danielPraying" },
    ],
  },
  {
    key: "autumnPast",
    n: 16,
    title: "Autumn Collectors' Sale",
    description: "Paintings, drawings and works of art. Results are final.",
    cover: COVER_IMAGES.venice,
    deliveryMode: "online",
    status: "ended",
    atVenue: false,
    categorySlug: "paintings",
    startsIn: -12 * DAY,
    endsIn: -5 * DAY,
    previewFrom: -16 * DAY,
    lots: [
      {
        work: "threeWomen",
        reserve: 90_000,
        bids: [
          ["collector", 95_000],
          ["rival", 105_000],
        ],
        outcome: "sold",
      },
      {
        work: "chelseaVase",
        reserve: 1_500,
        bids: [
          ["held", 1_600],
          ["rival", 1_700],
          ["held", 1_900],
        ],
        outcome: "sold",
      },
      { work: "denarius", reserve: 700, bids: [["rival", 500]], outcome: "unsold" },
      { work: "bronzeHorse", outcome: "withdrawn" },
      {
        work: "hiroshige",
        reserve: 4_500,
        bids: [
          ["northbank", 5_000],
          ["collector", 5_500],
        ],
        outcome: "sold",
      },
      // Purchases that are still to be paid, for the Pay page. The payer's one invoice is clear
      // to pay; three more take the payer past the card limit, so they pay by bank transfer.
      {
        work: "flowField",
        reserve: 1_200,
        bids: [
          ["rival", 1_400],
          ["payer", 1_500],
        ],
        outcome: "sold",
        invoice: { raisedDaysAgo: 2 },
      },
      {
        work: "brockbank",
        reserve: 3_000,
        bids: [
          ["rival", 3_600],
          ["payer", 3_800],
        ],
        outcome: "sold",
        invoice: { raisedDaysAgo: 1 },
      },
      {
        work: "bugattiTable",
        reserve: 7_000,
        bids: [
          ["rival", 7_600],
          ["payer", 7_800],
        ],
        outcome: "sold",
        invoice: { raisedDaysAgo: 3 },
      },
      {
        work: "stater",
        reserve: 6_000,
        bids: [
          ["rival", 6_200],
          ["payer", 6_400],
        ],
        outcome: "sold",
        invoice: { raisedDaysAgo: 4 },
      },
      // The rival's two invoices, paid by one bank transfer that has not yet arrived.
      {
        work: "muybridge",
        reserve: 12_000,
        bids: [
          ["payer", 13_000],
          ["rival", 14_000],
        ],
        outcome: "sold",
        invoice: { raisedDaysAgo: 2, transfer: true },
      },
      {
        work: "vivienMerlin",
        reserve: 8_000,
        bids: [
          ["payer", 9_500],
          ["rival", 10_000],
        ],
        outcome: "sold",
        invoice: { raisedDaysAgo: 2, transfer: true },
      },
      // Northbank Gallery's buyer agent won this; its owner pays the invoice.
      {
        work: "leRoyClock",
        reserve: 14_000,
        bids: [
          ["rival", 14_500],
          ["northbank", 15_000],
        ],
        outcome: "sold",
        invoice: { raisedDaysAgo: 3 },
      },
      // Northbank Gallery's one invoice that is clear to pay: £6,500 with the premium, won by
      // the owner, whose open purchases stay under the £9,000 source-of-funds threshold (the
      // buyer agent's £15,000 clock above is what holds the others in review). Finance pays it.
      {
        work: "creche",
        reserve: 4_000,
        bids: [
          ["rival", 5_000],
          ["northbankOwner", 5_200],
        ],
        outcome: "sold",
        invoice: { raisedDaysAgo: 1 },
      },
    ],
  },
];

export function buildFullCatalogue(now: number, actors: FullActors): DemoCatalogue {
  const bidder: Record<BidderKey, { userId: string; entityId: string }> = {
    collector: { userId: actors.collectorUserId, entityId: actors.collectorEntityId },
    rival: { userId: actors.rivalUserId, entityId: actors.rivalEntityId },
    northbank: { userId: actors.northbankBuyerUserId, entityId: actors.northbankId },
    northbankOwner: { userId: actors.northbankOwnerUserId, entityId: actors.northbankId },
    held: { userId: actors.heldUserId, entityId: actors.heldEntityId },
    payer: { userId: actors.payerUserId, entityId: actors.payerEntityId },
  };

  const sales: DemoSale[] = [];
  const lots: DemoLot[] = [];
  const bids: DemoBid[] = [];
  const payments: DemoPayment[] = [];
  const paymentGroups: DemoPaymentGroup[] = [];
  const fulfilments: DemoFulfilment[] = [];
  const registrations: DemoRegistration[] = [];
  const watches: DemoWatch[] = [];
  let lotSeq = 100;
  let bidSeq = 200;
  let paymentSeq = 100;
  let registrationSeq = 100;

  for (const spec of SALES) {
    const timed = spec.firstLotCloses !== undefined;
    const lastClose = timed
      ? now + (spec.firstLotCloses ?? 0) + (spec.lotGap ?? 0) * (spec.lots.length - 1)
      : now + spec.endsIn;
    const sale: DemoSale = {
      key: spec.key,
      id: DEMO_IDS.sale(spec.n),
      title: spec.title,
      description: spec.description,
      coverImage: demoImageUrl(spec.cover, "cover"),
      deliveryMode: spec.deliveryMode,
      status: spec.status,
      startTime: onTheHour(now + spec.startsIn),
      endTime: onTheHour(spec.status === "active" ? lastClose : now + spec.endsIn),
      previewStartTime: onTheHour(now + spec.previewFrom),
      atVenue: spec.atVenue,
      categorySlug: spec.categorySlug,
    };
    sales.push(sale);
    const ended = spec.status === "ended";

    spec.lots.forEach((lotSpec, index) => {
      lotSeq += 1;
      const work = WORKS[lotSpec.work];
      const id = DEMO_IDS.lot(lotSeq);
      const [low, high] = work.estimate;
      const startingPrice = Math.round(low * 0.5);
      const specBids = lotSpec.bids ?? [];
      const top = specBids.at(-1);
      const reserve = lotSpec.reserve ?? Math.round(low * 0.8);
      const sold = ended && lotSpec.outcome === "sold" && top !== undefined;
      const withdrawn = ended && lotSpec.outcome === "withdrawn";
      const endTime =
        spec.status === "active"
          ? onTheHour(now + (spec.firstLotCloses ?? 0) + (spec.lotGap ?? 0) * index)
          : sale.endTime;
      const lot: DemoLot = {
        id,
        saleId: sale.id,
        lotNumber: index + 1,
        title: work.title,
        description: `${work.maker}. ${work.note}`,
        medium: work.medium,
        dimensions: work.dimensions,
        image: demoImageUrl(work.image, "lot"),
        categorySlug: work.department,
        sellerEntityId: actors.laxStockId,
        artistId: workArtistId(lotSpec.work),
        startingPrice,
        reservePrice: reserve,
        estimateLow: low,
        estimateHigh: high,
        minBidIncrement: low >= 20_000 ? 1_000 : low >= 5_000 ? 250 : low >= 1_000 ? 100 : 50,
        status: withdrawn
          ? "cancelled"
          : ended
            ? "ended"
            : spec.status === "active"
              ? "active"
              : "scheduled",
        startTime: sale.startTime,
        endTime,
        currentPrice: top ? top[1] : startingPrice,
        winnerUserId: sold && top ? bidder[top[0]].userId : null,
        buyerEntityId: sold && top ? bidder[top[0]].entityId : null,
      };
      lots.push(lot);

      const spacing = specBids.length > 8 ? 2 * HOUR : 3 * HOUR;
      specBids.forEach(([who, amount], bidIndex) => {
        bidSeq += 1;
        const isTop = bidIndex === specBids.length - 1;
        const placed =
          Math.min(endTime.getTime(), now) -
          (specBids.length - bidIndex) * spacing -
          index * 7 * 60_000;
        bids.push({
          id: DEMO_IDS.bid(bidSeq),
          lotId: id,
          bidderUserId: bidder[who].userId,
          buyerEntityId: bidder[who].entityId,
          amount,
          isWinning: isTop && (!ended || sold),
          createdAt: new Date(Math.max(placed, sale.startTime.getTime() + HOUR)),
        });
      });

      if (sold && top) {
        paymentSeq += 1;
        const paymentId = DEMO_IDS.payment(paymentSeq);
        // The held buyer's invoice is still open, and so are the ones that ask for it; the others
        // were settled after the close.
        const open = top[0] === "held" || lotSpec.invoice !== undefined;
        const transfer = lotSpec.invoice?.transfer === true;
        const raisedAt = lotSpec.invoice
          ? new Date(now - lotSpec.invoice.raisedDaysAgo * DAY)
          : open
            ? new Date(now - 4 * DAY)
            : new Date(sale.endTime.getTime() + 5 * HOUR);
        payments.push(
          demoPayment({
            id: paymentId,
            lotId: id,
            buyerUserId: bidder[top[0]].userId,
            buyerEntityId: bidder[top[0]].entityId,
            sellerEntityId: lot.sellerEntityId,
            hammer: top[1],
            status: transfer ? "authorized" : open ? "pending" : "captured",
            createdAt: raisedAt,
            paymentGroupId: transfer ? DEMO_IDS.paymentGroup(1) : null,
          }),
        );
        if (!open && lotSpec.work === "hiroshige") {
          fulfilments.push({
            id: DEMO_IDS.fulfilment(100 + fulfilments.length + 1),
            lotId: id,
            paymentId,
            status: "in_transit",
            updatedAt: new Date(now - 1 * DAY),
          });
        }
      }
    });

    const registered: BidderKey[] =
      spec.key === "depts"
        ? ["collector", "rival", "northbank"]
        : spec.key === "autumnPast"
          ? ["collector", "rival", "northbank", "northbankOwner", "held", "payer"]
          : spec.key === "room"
            ? ["collector", "rival"]
            : [];
    for (const who of registered) {
      registrationSeq += 1;
      registrations.push({
        id: DEMO_IDS.registration(registrationSeq),
        saleId: sale.id,
        userId: bidder[who].userId,
        buyerEntityId: bidder[who].entityId,
        requestedAt: new Date(sale.previewStartTime.getTime() + HOUR),
      });
    }
  }

  const transferring = payments.filter((p) => p.paymentGroupId !== null);
  const [firstTransfer] = transferring;
  if (firstTransfer?.paymentGroupId) {
    paymentGroups.push({
      id: firstTransfer.paymentGroupId,
      buyerEntityId: firstTransfer.buyerEntityId,
      createdByUserId: firstTransfer.buyerUserId,
      totalPence: transferring.reduce((sum, p) => sum + p.invoice.totalPence, 0),
      createdAt: new Date(Math.max(...transferring.map((p) => p.createdAt.getTime())) + HOUR),
    });
  }

  const lotOf = (saleKey: string, work: WorkKey): DemoLot => {
    const sale = sales.find((s) => s.key === saleKey);
    const found = lots.find((l) => l.saleId === sale?.id && l.title === WORKS[work].title);
    if (!found) throw new Error(`full demo catalogue: no lot ${work} in ${saleKey}`);
    return found;
  };
  (
    [
      ["depts", "sete"],
      ["depts", "ageOfBronze"],
      ["depts", "hardouyn"],
      ["room", "berceuse"],
      ["photoPrints", "greatWave"],
    ] as const
  ).forEach(([saleKey, work], index) => {
    watches.push({
      id: DEMO_IDS.watch(100 + index + 1),
      userId: actors.collectorUserId,
      lotId: lotOf(saleKey, work).id,
      createdAt: new Date(now - (index + 1) * 6 * HOUR),
    });
  });

  return {
    sales,
    lots,
    bids,
    payments,
    paymentGroups,
    submissions: [],
    payouts: [],
    registrations,
    watches,
    fulfilments,
  };
}

export const FULL_SALE_KEYS = SALES.map((s) => s.key);

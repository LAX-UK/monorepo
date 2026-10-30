/**
 * What the demo top-up shows, as plain data: five sales (live, saleroom, upcoming and two
 * finished), their lots and bids, the purchases and payouts that follow from them, and the
 * consignments behind Northbank Gallery's lots. Dates follow the wall clock at seed time so a
 * live sale is live whenever the seed is run.
 *
 * Pure: no database access, so the rules (one winning bid per lot, prices matching bids, sale
 * windows around the clock) are tested without I/O.
 */
import { DEMO_IDS } from "./demo-topup-ids.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const unsplash = (photo: string) => `https://images.unsplash.com/photo-${photo}?w=1200&q=80`;

/** Artwork photographs used for lots and consignments. */
const ART = [
  unsplash("1578301978693-85fa9c0320b9"),
  unsplash("1578926375605-eaf7559b1458"),
  unsplash("1536924940846-227afb31e2a5"),
  unsplash("1515405295579-ba7b45403062"),
  unsplash("1574182245530-967d9b3831af"),
  unsplash("1581337204873-ef36aa186caa"),
  unsplash("1561214115-f2f134cc4912"),
  unsplash("1580136579312-94651dfd596d"),
  unsplash("1547891654-e66ed7ebb968"),
] as const;

/** Gallery and saleroom photographs used for sale covers. */
const COVERS = [
  unsplash("1582555172866-f73bb12a2ab3"),
  unsplash("1554907984-15263bfd63bd"),
  unsplash("1572947650440-e8a97ef053b2"),
  unsplash("1518998053901-5348d3961a04"),
] as const;

export const BUYER_PREMIUM_RATE = 0.25;
/** The seller's commission LAX keeps from the hammer price on a payout. */
export const SELLER_COMMISSION_RATE = 0.1;

/** The ids of the people and accounts the catalogue refers to. */
export type DemoActors = {
  collectorUserId: string;
  collectorEntityId: string;
  rivalUserId: string;
  rivalEntityId: string;
  northbankBuyerUserId: string;
  northbankId: string;
  consignorUserId: string;
  laxStockId: string;
};

type SaleKey = "live" | "saleroom" | "upcoming" | "finished" | "older";

export type DemoSale = {
  key: SaleKey;
  id: string;
  title: string;
  description: string;
  coverImage: string;
  deliveryMode: "online" | "onsite" | "hybrid";
  status: "scheduled" | "active" | "ended";
  startTime: Date;
  endTime: Date;
  previewStartTime: Date;
  atVenue: boolean;
  categorySlug: string;
};

export type DemoLot = {
  id: string;
  saleId: string;
  lotNumber: number;
  title: string;
  description: string;
  medium: string;
  dimensions: string;
  image: string;
  categorySlug: string;
  sellerEntityId: string;
  startingPrice: number;
  reservePrice: number;
  estimateLow: number;
  estimateHigh: number;
  minBidIncrement: number;
  status: "scheduled" | "active" | "ended";
  startTime: Date;
  endTime: Date;
  /** The highest bid, or the starting price when there are none. */
  currentPrice: number;
  winnerUserId: string | null;
  buyerEntityId: string | null;
};

export type DemoBid = {
  id: string;
  lotId: string;
  bidderUserId: string;
  buyerEntityId: string;
  amount: number;
  isWinning: boolean;
  createdAt: Date;
};

export type DemoPayment = {
  id: string;
  lotId: string;
  buyerUserId: string;
  buyerEntityId: string;
  sellerEntityId: string;
  hammer: number;
  status: "pending" | "captured";
  /** When the invoice was raised: it is due 7 days later. */
  createdAt: Date;
};

export type DemoSubmission = {
  id: string;
  legalEntityId: string;
  submittedByUserId: string;
  title: string;
  description: string;
  medium: string;
  dimensions: string;
  yearOfWork: string;
  image: string;
  askingPrice: number;
  status: "draft" | "submitted" | "under_review" | "approved" | "changes_requested" | "converted";
  convertedLotId: string | null;
  changesRequestedNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DemoPayout = {
  id: string;
  lineId: string;
  legalEntityId: string;
  paymentId: string;
  hammer: number;
  status: "scheduled" | "paid";
  periodStart: Date;
  periodEnd: Date;
  processedAt: Date | null;
};

export type DemoRegistration = {
  id: string;
  saleId: string;
  userId: string;
  buyerEntityId: string;
  requestedAt: Date;
};

export type DemoWatch = { id: string; userId: string; lotId: string; createdAt: Date };

export type DemoCatalogue = {
  sales: DemoSale[];
  lots: DemoLot[];
  bids: DemoBid[];
  payments: DemoPayment[];
  submissions: DemoSubmission[];
  payouts: DemoPayout[];
  registrations: DemoRegistration[];
  watches: DemoWatch[];
};

/** Rounds down to the hour, so times read cleanly on the pages. */
function onTheHour(ms: number): Date {
  return new Date(Math.floor(ms / HOUR) * HOUR);
}

type LotSpec = {
  title: string;
  description: string;
  medium: string;
  dimensions: string;
  estimate: [number, number];
  seller: "lax" | "northbank";
  /** Bids in the order they were placed: [who, amount]. The last is the highest. */
  bids?: [BidderKey, number][];
  /** Ended lots: whether the highest bid met the reserve. */
  sold?: boolean;
};

type BidderKey = "collector" | "rival" | "northbank";

function buildSales(now: number): DemoSale[] {
  const liveEnd = onTheHour(now + 3 * DAY);
  return [
    {
      key: "live",
      id: DEMO_IDS.sale(1),
      title: "Modern & Contemporary: Online",
      description:
        "Paintings and works on paper from British and European artists, closing lot by lot.",
      coverImage: COVERS[0],
      deliveryMode: "online",
      status: "active",
      startTime: onTheHour(now - 2 * DAY),
      endTime: liveEnd,
      previewStartTime: onTheHour(now - 5 * DAY),
      atVenue: false,
      categorySlug: "contemporary",
    },
    {
      key: "saleroom",
      id: DEMO_IDS.sale(2),
      title: "The November Room: Mayfair Live",
      description:
        "An evening sale in the Mayfair saleroom, with bidding in the room, by phone and online.",
      coverImage: COVERS[1],
      deliveryMode: "hybrid",
      status: "active",
      startTime: onTheHour(now - 1 * HOUR),
      endTime: onTheHour(now + 1 * DAY),
      previewStartTime: onTheHour(now - 4 * DAY),
      atVenue: true,
      categorySlug: "paintings",
    },
    {
      key: "upcoming",
      id: DEMO_IDS.sale(3),
      title: "Winter Evening Sale",
      description: "Modern British and contemporary paintings, sculpture and works on paper.",
      coverImage: COVERS[2],
      deliveryMode: "hybrid",
      status: "scheduled",
      startTime: onTheHour(now + 10 * DAY),
      endTime: onTheHour(now + 11 * DAY),
      previewStartTime: onTheHour(now - 1 * DAY),
      atVenue: true,
      categorySlug: "paintings",
    },
    {
      key: "finished",
      id: DEMO_IDS.sale(4),
      title: "Autumn Works on Paper",
      description: "Drawings, watercolours and prints. Results are final.",
      coverImage: COVERS[3],
      deliveryMode: "online",
      status: "ended",
      startTime: onTheHour(now - 10 * DAY),
      endTime: onTheHour(now - 3 * DAY),
      previewStartTime: onTheHour(now - 14 * DAY),
      atVenue: false,
      categorySlug: "drawings",
    },
    {
      key: "older",
      id: DEMO_IDS.sale(5),
      title: "September Modern British",
      description: "Landscapes and interiors from the twentieth century. Results are final.",
      coverImage: COVERS[0],
      deliveryMode: "online",
      status: "ended",
      startTime: onTheHour(now - 24 * DAY),
      endTime: onTheHour(now - 16 * DAY),
      previewStartTime: onTheHour(now - 28 * DAY),
      atVenue: false,
      categorySlug: "paintings",
    },
  ];
}

const LOT_SPECS: Record<SaleKey, LotSpec[]> = {
  live: [
    {
      title: "Harbour at First Light",
      description: "A quiet harbour at dawn, painted from life over several mornings.",
      medium: "Oil on linen",
      dimensions: "60 × 80 cm",
      estimate: [4000, 6000],
      seller: "lax",
      bids: [
        ["rival", 3800],
        ["collector", 4200],
      ],
    },
    {
      title: "Blue Interior with Lemons",
      description: "A sunlit interior in blues and yellows, signed and dated on the reverse.",
      medium: "Oil on canvas",
      dimensions: "70 × 90 cm",
      estimate: [5000, 7000],
      seller: "lax",
      bids: [
        ["collector", 5500],
        ["rival", 6000],
      ],
    },
    {
      title: "Still Life with Peonies",
      description: "Consigned by Northbank Gallery. Flowers in a stoneware jug, in a dark room.",
      medium: "Oil on board",
      dimensions: "40 × 50 cm",
      estimate: [2500, 3500],
      seller: "northbank",
      bids: [["rival", 2400]],
    },
    {
      title: "Estuary, Evening",
      description: "The estuary at low tide, the light going. Bought by the present owner in 2011.",
      medium: "Oil on canvas",
      dimensions: "90 × 120 cm",
      estimate: [6000, 9000],
      seller: "lax",
      bids: [
        ["rival", 6500],
        ["northbank", 7000],
      ],
    },
    {
      title: "Study in Ochre",
      description: "An abstract study in earth colours, from the artist's studio sale.",
      medium: "Acrylic on paper",
      dimensions: "50 × 65 cm",
      estimate: [1200, 1800],
      seller: "lax",
    },
    {
      title: "The Long Field",
      description: "A wide Suffolk field under a high summer sky.",
      medium: "Oil on canvas",
      dimensions: "50 × 100 cm",
      estimate: [1800, 2500],
      seller: "lax",
      bids: [["rival", 1900]],
    },
    {
      title: "Night Garden",
      description: "A garden at night, lit from a window. Signed lower left.",
      medium: "Gouache on paper",
      dimensions: "38 × 46 cm",
      estimate: [900, 1400],
      seller: "lax",
    },
    {
      title: "Abstract in Cobalt",
      description: "Layered blues with a single line of red, from a series of six.",
      medium: "Mixed media on canvas",
      dimensions: "80 × 80 cm",
      estimate: [2800, 3800],
      seller: "lax",
      bids: [
        ["northbank", 2900],
        ["rival", 3100],
      ],
    },
  ],
  saleroom: [
    {
      title: "Thames at Chelsea Reach",
      description: "The river in winter light, from the artist's riverside studio.",
      medium: "Oil on canvas",
      dimensions: "76 × 102 cm",
      estimate: [8000, 12000],
      seller: "lax",
      bids: [["rival", 7500]],
    },
    {
      title: "Woman Reading",
      description: "A seated figure by a window. Exhibited in London in 1998.",
      medium: "Oil on canvas",
      dimensions: "61 × 51 cm",
      estimate: [5000, 8000],
      seller: "lax",
    },
    {
      title: "Lowland Storm",
      description: "Clouds breaking over a lowland valley, painted in a single sitting.",
      medium: "Oil on board",
      dimensions: "45 × 60 cm",
      estimate: [3000, 5000],
      seller: "lax",
      bids: [["collector", 3200]],
    },
    {
      title: "Composition, Red and Black",
      description: "A late abstract, signed and dated on the stretcher.",
      medium: "Acrylic on canvas",
      dimensions: "100 × 100 cm",
      estimate: [6000, 9000],
      seller: "lax",
    },
    {
      title: "Garden Flowers in a Glass Vase",
      description: "A summer still life, in its original frame.",
      medium: "Oil on canvas",
      dimensions: "55 × 46 cm",
      estimate: [2000, 3000],
      seller: "lax",
    },
  ],
  upcoming: [
    {
      title: "The Valley in Spring",
      description: "A broad valley in the first green of spring.",
      medium: "Oil on canvas",
      dimensions: "100 × 150 cm",
      estimate: [12000, 18000],
      seller: "lax",
    },
    {
      title: "Morning Sea",
      description: "Consigned by Northbank Gallery. The sea at Walberswick, early morning.",
      medium: "Oil on linen",
      dimensions: "60 × 90 cm",
      estimate: [4000, 6000],
      seller: "northbank",
    },
    {
      title: "Figures on a Beach",
      description: "Bathers and walkers on a wide beach, painted in the 1960s.",
      medium: "Oil on board",
      dimensions: "45 × 70 cm",
      estimate: [7000, 10000],
      seller: "lax",
    },
    {
      title: "Flowers for Ana",
      description: "A bright still life, given by the artist to a friend.",
      medium: "Oil on canvas",
      dimensions: "50 × 40 cm",
      estimate: [2500, 3500],
      seller: "lax",
    },
    {
      title: "Head of a Young Man",
      description: "A portrait study in charcoal and white chalk.",
      medium: "Charcoal on paper",
      dimensions: "42 × 30 cm",
      estimate: [1500, 2500],
      seller: "lax",
    },
    {
      title: "Blue Abstract No. 3",
      description: "From the artist's series of blue abstracts.",
      medium: "Acrylic on canvas",
      dimensions: "120 × 90 cm",
      estimate: [9000, 14000],
      seller: "lax",
    },
  ],
  finished: [
    {
      title: "Coastal Notation",
      description: "A coastline in quick pencil and wash, from a sketchbook.",
      medium: "Watercolour on paper",
      dimensions: "30 × 42 cm",
      estimate: [1500, 2500],
      seller: "lax",
      bids: [
        ["rival", 1700],
        ["collector", 1900],
      ],
      sold: true,
    },
    {
      title: "Morning Rain, Kensington",
      description: "A wet street in Kensington, the shopfronts lit.",
      medium: "Watercolour and gouache",
      dimensions: "35 × 50 cm",
      estimate: [2000, 3000],
      seller: "lax",
      bids: [
        ["rival", 2400],
        ["collector", 2600],
      ],
      sold: true,
    },
    {
      title: "Quiet Harbour",
      description: "Consigned by Northbank Gallery. Boats at rest in a small harbour.",
      medium: "Pen and ink with wash",
      dimensions: "28 × 38 cm",
      estimate: [3500, 5000],
      seller: "northbank",
      bids: [
        ["collector", 4400],
        ["rival", 4800],
      ],
      sold: true,
    },
    {
      title: "Field Notes II",
      description: "Consigned by Northbank Gallery. Studies of grasses and seed heads.",
      medium: "Pencil on paper",
      dimensions: "40 × 30 cm",
      estimate: [2500, 3500],
      seller: "northbank",
      bids: [["rival", 1800]],
      sold: false,
    },
    {
      title: "Red Kite",
      description: "A red kite over the Chilterns, in watercolour.",
      medium: "Watercolour on paper",
      dimensions: "36 × 48 cm",
      estimate: [1200, 1800],
      seller: "lax",
      bids: [
        ["rival", 1300],
        ["northbank", 1500],
      ],
      sold: true,
    },
    {
      title: "Lantern Study",
      description: "A lantern on a table, in red chalk.",
      medium: "Red chalk on paper",
      dimensions: "25 × 20 cm",
      estimate: [800, 1200],
      seller: "lax",
      bids: [["rival", 950]],
      sold: true,
    },
  ],
  older: [
    {
      title: "Pale Shore",
      description: "A shoreline in winter, almost colourless.",
      medium: "Oil on board",
      dimensions: "40 × 60 cm",
      estimate: [2000, 3000],
      seller: "lax",
      bids: [
        ["rival", 2100],
        ["northbank", 2300],
      ],
      sold: true,
    },
    {
      title: "Winter Orchard",
      description: "Bare apple trees in snow, in the Herefordshire hills.",
      medium: "Oil on canvas",
      dimensions: "50 × 60 cm",
      estimate: [3000, 4500],
      seller: "lax",
      bids: [["northbank", 3400]],
      sold: true,
    },
    {
      title: "The Lock Keeper's House",
      description: "Consigned by Northbank Gallery. A lock on the Kennet and Avon canal.",
      medium: "Oil on canvas",
      dimensions: "60 × 75 cm",
      estimate: [5000, 7000],
      seller: "northbank",
      bids: [
        ["collector", 5800],
        ["rival", 6200],
      ],
      sold: true,
    },
    {
      title: "Grey Morning",
      description: "Rooftops and chimneys under a grey sky.",
      medium: "Oil on canvas",
      dimensions: "45 × 55 cm",
      estimate: [1500, 2500],
      seller: "lax",
      bids: [["collector", 1800]],
      sold: true,
    },
  ],
};

const CATEGORY_BY_MEDIUM = (medium: string): string => {
  const m = medium.toLowerCase();
  if (m.includes("pencil") || m.includes("charcoal") || m.includes("chalk") || m.includes("ink"))
    return "drawings";
  if (m.includes("mixed")) return "mixed-media";
  if (m.includes("acrylic") && m.includes("canvas")) return "contemporary";
  return "paintings";
};

/** Builds the whole catalogue for the clock reading `now` (milliseconds). */
export function buildDemoCatalogue(now: number, actors: DemoActors): DemoCatalogue {
  const sales = buildSales(now);
  const lots: DemoLot[] = [];
  const bids: DemoBid[] = [];
  const lotIdByTitle = new Map<string, string>();
  const bidder: Record<BidderKey, { userId: string; entityId: string }> = {
    collector: { userId: actors.collectorUserId, entityId: actors.collectorEntityId },
    rival: { userId: actors.rivalUserId, entityId: actors.rivalEntityId },
    northbank: { userId: actors.northbankBuyerUserId, entityId: actors.northbankId },
  };

  let lotSeq = 0;
  let bidSeq = 0;
  let imageSeq = 0;
  for (const sale of sales) {
    LOT_SPECS[sale.key].forEach((spec, index) => {
      lotSeq += 1;
      const id = DEMO_IDS.lot(lotSeq);
      lotIdByTitle.set(spec.title, id);
      const [low, high] = spec.estimate;
      const startingPrice = Math.round(low * 0.7);
      const specBids = spec.bids ?? [];
      const top = specBids.at(-1);
      const ended = sale.status === "ended";
      const sold = ended && spec.sold === true && top !== undefined;
      // Lots close two minutes apart, as an online sale does.
      const endTime = ended ? sale.endTime : new Date(sale.endTime.getTime() + index * 2 * 60_000);
      const lotStatus = sale.status === "scheduled" ? "scheduled" : ended ? "ended" : "active";
      lots.push({
        id,
        saleId: sale.id,
        lotNumber: index + 1,
        title: spec.title,
        description: spec.description,
        medium: spec.medium,
        dimensions: spec.dimensions,
        image: ART[imageSeq++ % ART.length] ?? ART[0],
        categorySlug: CATEGORY_BY_MEDIUM(spec.medium),
        sellerEntityId: spec.seller === "northbank" ? actors.northbankId : actors.laxStockId,
        startingPrice,
        // Sold lots met their reserve; an unsold lot's top bid fell short of it.
        reservePrice: sold || !ended ? Math.round(low * 0.8) : Math.round(low * 0.9),
        estimateLow: low,
        estimateHigh: high,
        minBidIncrement: low >= 5000 ? 250 : 100,
        status: lotStatus,
        startTime: sale.startTime,
        endTime,
        currentPrice: top ? top[1] : startingPrice,
        winnerUserId: sold && top ? bidder[top[0]].userId : null,
        buyerEntityId: sold && top ? bidder[top[0]].entityId : null,
      });
      specBids.forEach(([who, amount], bidIndex) => {
        bidSeq += 1;
        const isTop = bidIndex === specBids.length - 1;
        const placed = Math.min(endTime.getTime(), now) - (specBids.length - bidIndex) * 5 * HOUR;
        bids.push({
          id: DEMO_IDS.bid(bidSeq),
          lotId: id,
          bidderUserId: bidder[who].userId,
          buyerEntityId: bidder[who].entityId,
          amount,
          // On a live lot the top bid leads; on an ended lot it won only if the lot sold.
          isWinning: isTop && (!ended || sold),
          createdAt: new Date(placed),
        });
      });
    });
  }

  const lot = (title: string): DemoLot => {
    const found = lots.find((l) => l.title === title);
    if (!found) throw new Error(`demo catalogue: no lot "${title}"`);
    return found;
  };
  const finishedEnd = sales.find((s) => s.key === "finished")?.endTime.getTime() ?? now;
  const olderEnd = sales.find((s) => s.key === "older")?.endTime.getTime() ?? now;

  // Invoices for the sold lots: due, overdue or paid, depending on when they were raised.
  const paymentSpecs: [string, "pending" | "captured", number][] = [
    ["Coastal Notation", "pending", now - 1 * DAY],
    ["Morning Rain, Kensington", "captured", finishedEnd + 6 * HOUR],
    ["Quiet Harbour", "captured", finishedEnd + 4 * HOUR],
    ["Red Kite", "pending", now - 2 * DAY],
    ["Lantern Study", "captured", finishedEnd + 8 * HOUR],
    ["Pale Shore", "pending", olderEnd + 2 * HOUR],
    ["Winter Orchard", "captured", olderEnd + 5 * HOUR],
    ["The Lock Keeper's House", "captured", olderEnd + 3 * HOUR],
    ["Grey Morning", "captured", olderEnd + 7 * HOUR],
  ];
  const payments: DemoPayment[] = paymentSpecs.map(([title, status, raisedAt], index) => {
    const sold = lot(title);
    if (!sold.winnerUserId || !sold.buyerEntityId) {
      throw new Error(`demo catalogue: "${title}" has no buyer`);
    }
    return {
      id: DEMO_IDS.payment(index + 1),
      lotId: sold.id,
      buyerUserId: sold.winnerUserId,
      buyerEntityId: sold.buyerEntityId,
      sellerEntityId: sold.sellerEntityId,
      hammer: sold.currentPrice,
      status,
      createdAt: new Date(raisedAt),
    };
  });
  const paymentFor = (title: string): DemoPayment => {
    const lotId = lot(title).id;
    const found = payments.find((p) => p.lotId === lotId);
    if (!found) throw new Error(`demo catalogue: no payment for "${title}"`);
    return found;
  };

  // Northbank's payouts: one due from the recent sale, one paid from September.
  const payouts: DemoPayout[] = [
    {
      id: DEMO_IDS.payout(1),
      lineId: DEMO_IDS.payoutLine(1),
      legalEntityId: actors.northbankId,
      paymentId: paymentFor("Quiet Harbour").id,
      hammer: lot("Quiet Harbour").currentPrice,
      status: "scheduled",
      periodStart: new Date(finishedEnd - 7 * DAY),
      periodEnd: new Date(finishedEnd + 1 * DAY),
      processedAt: null,
    },
    {
      id: DEMO_IDS.payout(2),
      lineId: DEMO_IDS.payoutLine(2),
      legalEntityId: actors.northbankId,
      paymentId: paymentFor("The Lock Keeper's House").id,
      hammer: lot("The Lock Keeper's House").currentPrice,
      status: "paid",
      periodStart: new Date(olderEnd - 7 * DAY),
      periodEnd: new Date(olderEnd + 1 * DAY),
      processedAt: new Date(olderEnd + 9 * DAY),
    },
  ];

  const submissions = buildSubmissions(now, actors, (title) => lot(title).id);

  const registrations: DemoRegistration[] = [
    ["live", actors.collectorUserId, actors.collectorEntityId],
    ["saleroom", actors.collectorUserId, actors.collectorEntityId],
    ["upcoming", actors.collectorUserId, actors.collectorEntityId],
    ["live", actors.rivalUserId, actors.rivalEntityId],
    ["saleroom", actors.rivalUserId, actors.rivalEntityId],
    ["finished", actors.rivalUserId, actors.rivalEntityId],
    ["older", actors.rivalUserId, actors.rivalEntityId],
    ["finished", actors.collectorUserId, actors.collectorEntityId],
    ["older", actors.collectorUserId, actors.collectorEntityId],
    ["live", actors.northbankBuyerUserId, actors.northbankId],
    ["finished", actors.northbankBuyerUserId, actors.northbankId],
    ["older", actors.northbankBuyerUserId, actors.northbankId],
  ].map(([key, userId, buyerEntityId], index) => {
    const sale = sales.find((s) => s.key === key);
    if (!sale) throw new Error(`demo catalogue: no sale "${key}"`);
    return {
      id: DEMO_IDS.registration(index + 1),
      saleId: sale.id,
      userId: userId as string,
      buyerEntityId: buyerEntityId as string,
      requestedAt: new Date(sale.previewStartTime.getTime() + HOUR),
    };
  });

  const watches: DemoWatch[] = [
    "Study in Ochre",
    "Night Garden",
    "Woman Reading",
    "The Valley in Spring",
    "Blue Interior with Lemons",
  ].map((title, index) => ({
    id: DEMO_IDS.watch(index + 1),
    userId: actors.collectorUserId,
    lotId: lot(title).id,
    createdAt: new Date(now - (index + 1) * DAY),
  }));

  return { sales, lots, bids, payments, submissions, payouts, registrations, watches };
}

function buildSubmissions(
  now: number,
  actors: DemoActors,
  lotId: (title: string) => string,
): DemoSubmission[] {
  type Spec = Omit<
    DemoSubmission,
    "id" | "legalEntityId" | "submittedByUserId" | "createdAt" | "updatedAt"
  > & {
    owner: "northbank" | "collector";
    ageDays: number;
  };
  const specs: Spec[] = [
    {
      owner: "northbank",
      title: "Coastal Study No. 4",
      description: "Oil sketch of the Norfolk coast from the gallery's own collection.",
      medium: "Oil on board",
      dimensions: "30 × 40 cm",
      yearOfWork: "2019",
      image: ART[0],
      askingPrice: 3500,
      status: "draft",
      convertedLotId: null,
      changesRequestedNote: null,
      ageDays: 2,
    },
    {
      owner: "northbank",
      title: "Portrait of a Woman in Green",
      description: "Half-length portrait, signed upper right. Sent for review this week.",
      medium: "Oil on canvas",
      dimensions: "76 × 63 cm",
      yearOfWork: "1958",
      image: ART[4],
      askingPrice: 9000,
      status: "submitted",
      convertedLotId: null,
      changesRequestedNote: null,
      ageDays: 4,
    },
    {
      owner: "northbank",
      title: "Estuary at Dusk",
      description: "The estuary at dusk, signed lower right.",
      medium: "Oil on canvas",
      dimensions: "50 × 70 cm",
      yearOfWork: "2004",
      image: ART[3],
      askingPrice: 4000,
      status: "changes_requested",
      convertedLotId: null,
      changesRequestedNote:
        "Please add a clear photograph of the signature and the back of the canvas.",
      ageDays: 8,
    },
    {
      owner: "northbank",
      title: "Thames at Battersea",
      description: "Accepted for the Winter Evening Sale; the catalogue entry is being written.",
      medium: "Oil on canvas",
      dimensions: "61 × 91 cm",
      yearOfWork: "1972",
      image: ART[5],
      askingPrice: 6500,
      status: "approved",
      convertedLotId: null,
      changesRequestedNote: null,
      ageDays: 12,
    },
    ...(
      [
        ["Still Life with Peonies", "Oil on board", 2500, 20],
        ["Morning Sea", "Oil on linen", 4000, 18],
        ["Quiet Harbour", "Pen and ink with wash", 3500, 30],
        ["Field Notes II", "Pencil on paper", 2500, 30],
        ["The Lock Keeper's House", "Oil on canvas", 5000, 45],
      ] as const
    ).map(
      ([title, medium, asking, ageDays], index): Spec => ({
        owner: "northbank",
        title,
        description: "Consigned by Northbank Gallery.",
        medium,
        dimensions: "",
        yearOfWork: "",
        image: ART[(index + 6) % ART.length] ?? ART[0],
        askingPrice: asking,
        status: "converted",
        convertedLotId: lotId(title),
        changesRequestedNote: null,
        ageDays,
      }),
    ),
    {
      owner: "collector",
      title: "Evening Garden",
      description: "A small garden painting bought in Cornwall in the 1990s.",
      medium: "Oil on board",
      dimensions: "25 × 30 cm",
      yearOfWork: "1994",
      image: ART[6],
      askingPrice: 1200,
      status: "draft",
      convertedLotId: null,
      changesRequestedNote: null,
      ageDays: 1,
    },
    {
      owner: "collector",
      title: "Bronze Hare",
      description: "A cast bronze hare on a stone base, number 3 of 9.",
      medium: "Bronze",
      dimensions: "32 × 18 × 12 cm",
      yearOfWork: "2008",
      image: ART[7],
      askingPrice: 4500,
      status: "under_review",
      convertedLotId: null,
      changesRequestedNote: null,
      ageDays: 5,
    },
  ];
  return specs.map(({ owner, ageDays, ...spec }, index) => ({
    ...spec,
    id: DEMO_IDS.submission(index + 1),
    legalEntityId: owner === "northbank" ? actors.northbankId : actors.collectorEntityId,
    submittedByUserId: owner === "northbank" ? actors.consignorUserId : actors.collectorUserId,
    createdAt: new Date(now - ageDays * DAY),
    updatedAt: new Date(now - Math.max(0, ageDays - 1) * DAY),
  }));
}

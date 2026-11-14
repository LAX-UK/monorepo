/** The frame sold with one print, as the buyer bought it, and where the framing work stands. */
export type FramingFacts = {
  /** The framing order line. */
  lineId: string;
  name: string;
  frame: string;
  mount: string;
  glazing: string;
  hanging: string;
  leadTimeMinDays: number;
  leadTimeMaxDays: number;
  /** The framing task's status; null until the task is made. */
  taskStatus: "queued" | "framing" | "framed" | "completed" | "cancelled" | null;
  dueAt: Date | null;
  /** True once the framing line was refunded and released. */
  released: boolean;
};

/** One print sold on an order, with what its SKU and edition label are worked out from. */
export type PrintLineFacts = {
  lineId: string;
  /** True once the line was refunded and its print went back on sale. */
  released: boolean;
  printsArtworkId: string;
  /** Proof and companion listings are not part of the numbered run the ledger counts. */
  isMainRun: boolean;
  /** The Zoho Product of the original the prints were made from; null when it has none. */
  originalZohoProductId: string | null;
  editionType: "Numbered" | "Open" | null;
  runSize: number | null;
  /** The listing's sheet, paper and frame, in staff's words. */
  printSize: string | null;
  printPaper: string | null;
  printFrame: string | null;
  /** True when the artist framed the edition and describes the frame in words. */
  framedByArtist: boolean;
  allocation: "original_buyer_entitlement" | "artist" | "lax";
  /** The number allocated to the buyer at payment; null for open editions and proofs. */
  editionNumber: number | null;
  /** The print's label at payment, such as "7/24" or "AP 2/3". */
  printLabel: string | null;
  framing: FramingFacts | null;
};

/** The order's dispatch or collection, as staff record it in LAX Admin. */
export type DispatchFacts = {
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
};

/** What LAX knows about an order's prints and their fulfilment. No buyer details are read. */
export type OrderFulfilmentFacts = {
  orderId: string;
  /** What people quote for the order ("LAX-S-10482"); the reference Zoho records carry. */
  reference: string;
  paid: boolean;
  prints: PrintLineFacts[];
  /** True once staff confirmed any print on the order as picked for packing. */
  anyPackConfirmed: boolean;
  fulfilment: DispatchFacts | null;
};

/** Prints of a run sold on paid orders and not released, by who held them. */
export type RunSales = { collector: number; artist: number; lax: number };

/** Reads an order from Shop's tables. The mirror depends on this, not on Shop's tables. */
export interface OrderFulfilmentFactsReader {
  /** Null when the order does not exist. */
  read(orderId: string): Promise<OrderFulfilmentFacts | null>;
  /** The sold prints of one main-run listing, for its group's ledger. */
  runSales(printsArtworkId: string): Promise<RunSales>;
}

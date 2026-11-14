import type { FramingFacts, OrderFulfilmentFacts, PrintLineFacts } from "./order-facts.js";

/** A frame sold with a print, queued and not yet started. */
export const framing = (over: Partial<FramingFacts> = {}): FramingFacts => ({
  lineId: "fl-1",
  name: "Gallery black",
  frame: "black_wood",
  mount: "window_conservation",
  glazing: "uv_acrylic",
  hanging: "d_rings_cord",
  leadTimeMinDays: 10,
  leadTimeMaxDays: 15,
  taskStatus: null,
  dueAt: null,
  released: false,
  ...over,
});

/** A numbered A3 print on Hahnemühle, unframed, held for the collector. */
export const printLine = (over: Partial<PrintLineFacts> = {}): PrintLineFacts => ({
  lineId: "pl-1",
  released: false,
  printsArtworkId: "prints-1",
  isMainRun: true,
  originalZohoProductId: "zp-orig",
  editionType: "Numbered",
  runSize: 25,
  printSize: "A3",
  printPaper: "Hahnemühle Photo Rag",
  printFrame: null,
  framedByArtist: false,
  allocation: "original_buyer_entitlement",
  editionNumber: 7,
  printLabel: "7/25",
  framing: null,
  ...over,
});

/** A paid order with one print and no fulfilment yet. */
export const orderFacts = (over: Partial<OrderFulfilmentFacts> = {}): OrderFulfilmentFacts => ({
  orderId: "order-1",
  reference: "LAX-S-10482",
  paid: true,
  prints: [printLine()],
  anyPackConfirmed: false,
  fulfilment: null,
  ...over,
});

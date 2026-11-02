import type { CoverLotOption, CoverSlotView, CoverView } from "@/lib/admin/sale-cover/cover-view";
import { coverAnalysisHash, effectiveCoverSide, solveCoverScrim } from "@auction/domain";
import type { CoverAnalysis, SaleCoverSlot, SaleCoverSlotName } from "@auction/types";

export const SALE_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_SALE = "22222222-2222-4222-8222-222222222222";

export const LOTS: CoverLotOption[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    lotNumber: 1,
    title: "Harbour at First Light",
    images: ["https://cdn.example/lots/one.jpg"],
    dimensions: "60 × 80 cm",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    lotNumber: 2,
    title: "Blue Interior with Lemons",
    images: ["https://cdn.example/lots/two.jpg"],
    dimensions: "70 × 90 cm",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    lotNumber: 3,
    title: "The Long Field",
    images: [],
    dimensions: null,
  },
];

export function storedSlot(over: Partial<SaleCoverSlot> = {}): Omit<SaleCoverSlot, "analysisHash"> {
  return {
    key: "covers/estuary.jpg",
    width: 3600,
    height: 2400,
    focal: { x: 0.72, y: 0.46 },
    zoom: 1,
    alt: "Blue and white brushstrokes of evening water",
    ...over,
  };
}

const zones = Object.fromEntries(
  ["eyebrow", "title", "sub", "link", "credit"].map((line) => [
    line,
    { brightest: "#7d6a86", darkest: "#2a2038" },
  ]),
);

export function readyAnalysis(slot: Omit<SaleCoverSlot, "analysisHash">): CoverAnalysis {
  const side = effectiveCoverSide(slot);
  return {
    version: 1,
    dominant: "#3d5a80",
    deepest: "#1b2a40",
    field: "#0d1522",
    blurDataURL: "data:image/png;base64,AAAA",
    breakpoints: {
      desktop: solveCoverScrim("desktop", side, zones as never),
      wide: solveCoverScrim("wide", side, zones as never),
    },
  };
}

export function slotView(
  name: SaleCoverSlotName,
  slot: Omit<SaleCoverSlot, "analysisHash">,
  status: "pending" | "ready" | "failed" = "ready",
): CoverSlotView {
  return {
    source: "slot",
    slot: { ...slot, analysisHash: coverAnalysisHash(name, slot) },
    side: effectiveCoverSide(slot),
    issues: [],
    analysis: { status, value: status === "ready" ? readyAnalysis(slot) : null },
  };
}

export function coverView(over: Partial<CoverView> = {}): CoverView {
  return {
    saleId: SALE_ID,
    slots: {},
    home: { subtitle: null, featuredLotIds: [], consignmentDeadline: null, homePinOrder: null },
    pins: [],
    ...over,
  };
}

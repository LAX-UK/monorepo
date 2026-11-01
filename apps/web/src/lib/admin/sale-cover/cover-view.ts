import type { CoverSlotIssue } from "@auction/domain";
import type {
  CoverAnalysis,
  CoverAnalysisStatus,
  CoverTextSide,
  SaleCoverSlot,
  SaleCoverSlotName,
} from "@auction/types";

/** One cover slot as the admin read returns it. */
export type CoverSlotView = {
  source: "slot" | "legacy";
  slot?: SaleCoverSlot;
  /** The old array's picture, for a slot staff have not set yet. */
  legacyKey?: string;
  side?: CoverTextSide;
  issues: CoverSlotIssue[];
  analysis: { status: "pending" | CoverAnalysisStatus; value: CoverAnalysis | null };
};

export type HomePin = { saleId: string; title: string; position: number };

export type CoverHomeState = {
  subtitle: string | null;
  featuredLotIds: string[];
  /** ISO instant, or null. */
  consignmentDeadline: string | null;
  homePinOrder: number | null;
};

/** The sale's cover and home choices as `GET /admin/sales/:id/cover` returns them. */
export type CoverView = {
  saleId: string;
  slots: Partial<Record<SaleCoverSlotName, CoverSlotView>>;
  home: CoverHomeState;
  pins: HomePin[];
};

/** A lot staff can feature or take a cover detail from. */
export type CoverLotOption = {
  id: string;
  lotNumber: number | null;
  title: string;
  /** Storage keys of the lot's photographs, in order. */
  images: string[];
  /** The catalogue's size text, e.g. "90 × 120 cm". */
  dimensions: string | null;
};

export function lotLabel(lot: Pick<CoverLotOption, "lotNumber" | "title">): string {
  return lot.lotNumber != null ? `Lot ${lot.lotNumber} · ${lot.title}` : lot.title;
}

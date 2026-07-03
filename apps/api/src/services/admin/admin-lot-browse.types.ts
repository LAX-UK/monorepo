import type { LotStatus } from "@auction/types";

export type AdminLotBrowseState = "available" | "returned" | "all";

export type AdminLotBrowseInput = {
  q?: string | undefined;
  sellerLegalEntityId?: string | undefined;
  categoryIds?: string[] | undefined;
  artistId?: string | undefined;
  state?: AdminLotBrowseState | undefined;
  excludeSaleId?: string | undefined;
  limit: number;
  offset: number;
};

export type AdminAttachableLotRow = {
  id: string;
  title: string;
  status: LotStatus;
  sellerLegalEntityId: string;
  saleId: string | null;
  artistId: string | null;
  createdAt: Date;
  lifecycle: {
    kind: "new_draft" | "returned";
    returnedAt: Date | null;
    lastSaleId: string | null;
    lastSaleName: string | null;
    returnCount: number;
  };
};

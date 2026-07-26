import "server-only";

import { getLotFormAssignableSales } from "@/lib/admin/lot-form-sales";
import { getAdminArtistList, getAdminLotById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  emptyAdminLotFormValues,
  lotToAdminLotFormValues,
} from "@/lib/forms/schemas/admin-lot-defaults";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import type { ArtistProfile, CategoryNode, Sale } from "@auction/types";

type AssignableSale = Pick<
  Sale,
  "id" | "title" | "status" | "deliveryMode" | "startTime" | "endTime"
>;

export type LotCreatePageModel = {
  defaultValues: AdminLotFormValues;
  cloneFailed: boolean;
  categories: CategoryNode[];
  sales: AssignableSale[];
  currentSale: AssignableSale | null;
  emergencyAddSaleStatus: "scheduled" | "active" | null;
  artists: ArtistProfile[];
  englishOnlyAuctionsLocked: boolean;
  description: string | null;
  presetSaleId: string;
};

type LoadLotCreatePageInput = {
  fromLot?: string;
  saleId?: string;
};

function buildLotCreateDescription(input: {
  cloneFailed: boolean;
  fromLotId: string;
  presetSaleId: string;
  emergencyAddSaleStatus: "scheduled" | "active" | null;
  loadWarnings: string[];
}): string | null {
  if (input.cloneFailed) {
    return "Could not load the lot to clone — starting with a blank form.";
  }
  if (input.fromLotId) {
    return `Cloning catalogue fields from lot ${input.fromLotId.slice(0, 8)}… Schedule new dates before publishing.`;
  }
  if (input.presetSaleId && input.emergencyAddSaleStatus) {
    return "This lot will be added to the selected sale and scheduled immediately after creation.";
  }
  if (input.presetSaleId) {
    return "This lot will be assigned to the selected sale.";
  }
  if (input.loadWarnings.length > 0) {
    return `Some lists could not be loaded (${input.loadWarnings.join(", ")}). You can still create a draft.`;
  }
  return null;
}

/** Data/composition boundary for `/admin/lots/new`. */
export async function loadAdminLotCreatePage(
  input: LoadLotCreatePageInput = {},
): Promise<LotCreatePageModel> {
  const fromLotId = (input.fromLot ?? "").trim();
  const presetSaleId = (input.saleId ?? "").trim();
  const englishOnlyAuctionsLocked = isEnglishOnlyAuctionsLocked();

  let defaultValues = emptyAdminLotFormValues();
  let cloneFailed = false;

  if (fromLotId) {
    try {
      const existing = await getAdminLotById(fromLotId);
      if (existing) {
        defaultValues = {
          ...lotToAdminLotFormValues(existing),
          title: `${existing.title} (copy)`,
          saleId: "",
          lotNumber: null,
        };
      } else {
        cloneFailed = true;
      }
    } catch {
      cloneFailed = true;
    }
  }

  if (englishOnlyAuctionsLocked && defaultValues.auctionType !== "english") {
    defaultValues = { ...defaultValues, auctionType: "english" };
  }

  if (presetSaleId) {
    defaultValues = { ...defaultValues, saleId: presetSaleId };
  }

  const [categoriesResult, salesResult, artistResult] = await Promise.allSettled([
    (async () => (await getServerCategoryReader()).tree())(),
    getLotFormAssignableSales(presetSaleId || undefined),
    getAdminArtistList({ includeArchived: false, limit: 200 }),
  ]);

  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const salesResult_ =
    salesResult.status === "fulfilled" ? salesResult.value : { sales: [], currentSale: null };
  const sales = salesResult_.sales;
  const currentSale = salesResult_.currentSale;
  const emergencyAddSaleStatus =
    currentSale?.status === "scheduled" || currentSale?.status === "active"
      ? currentSale.status
      : null;
  const artists = artistResult.status === "fulfilled" ? artistResult.value.rows : [];

  const loadWarnings: string[] = [];
  if (categoriesResult.status === "rejected") loadWarnings.push("category tree");
  if (salesResult.status === "rejected") loadWarnings.push("sales list");
  if (artistResult.status === "rejected") loadWarnings.push("artist list");

  return {
    defaultValues,
    cloneFailed,
    categories,
    sales,
    currentSale,
    emergencyAddSaleStatus,
    artists,
    englishOnlyAuctionsLocked,
    description: buildLotCreateDescription({
      cloneFailed,
      fromLotId,
      presetSaleId,
      emergencyAddSaleStatus,
      loadWarnings,
    }),
    presetSaleId,
  };
}

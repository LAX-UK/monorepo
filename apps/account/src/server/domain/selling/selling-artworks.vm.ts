import { formatDate } from "@/lib/format-money";
import type { PortalArtistArtworks, PortalArtistSales } from "../../ports/selling-gateway";

const SALE_STATE_LABELS: Record<string, { label: string; tone: "success" | "neutral" }> = {
  for_sale: { label: "For sale", tone: "success" },
  price_on_application: { label: "Price on request", tone: "success" },
  sold: { label: "Sold", tone: "neutral" },
};

const ARTIST_SALE_CHANNELS: Record<string, string> = {
  shop_order: "LAX Shop",
  third_party: "Sold outside LAX",
};

export type ArtistArtworkVm = {
  artworkId: string;
  title: string;
  state: { label: string; tone: "success" | "neutral" };
};

export type ArtistSaleVm = {
  saleId: string;
  title: string;
  edition: string | null;
  soldOn: string | null;
  channel: string;
  salePricePence: number;
  feesPence: number | null;
  netPence: number | null;
  /** The artist's resale royalty applies to this sale. */
  resaleRoyalty: boolean;
};

export type ArtistPageVm = {
  artistName: string | null;
  artworks: ArtistArtworkVm[];
  sales: ArtistSaleVm[];
};

/**
 * The artist's own works and every recorded sale of them, whoever sold it. Fees and net are
 * known only where LAX paid the artist, so the rest are left blank rather than guessed.
 */
export function buildArtistPage(
  artworks: PortalArtistArtworks | null,
  sales: PortalArtistSales | null,
): ArtistPageVm {
  return {
    artistName: artworks?.artist?.displayName ?? sales?.artist?.displayName ?? null,
    artworks: (artworks?.items ?? []).map((item) => ({
      artworkId: item.artworkId,
      title: item.title,
      state: SALE_STATE_LABELS[item.saleState] ?? { label: "Not listed", tone: "neutral" },
    })),
    sales: (sales?.items ?? []).map((sale) => ({
      saleId: sale.saleId,
      title: sale.artworkTitle,
      edition: sale.editionNumber != null ? `Edition ${sale.editionNumber}` : null,
      soldOn: sale.occurredAt ? formatDate(sale.occurredAt) : null,
      channel: ARTIST_SALE_CHANNELS[sale.channel] ?? "LAX",
      salePricePence: sale.grossPence,
      feesPence: sale.feesPence,
      netPence: sale.netPence,
      resaleRoyalty: sale.arrApplicable === true,
    })),
  };
}

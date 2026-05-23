import { LotFilterForm } from "@/components/admin/lot-filter-form";
import { getAdminArtistList, getAdminSalesList } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";

type LotSort = "createdDesc" | "endingAsc" | "hammerDesc" | "endedDesc" | "sellerAsc";

type Props = {
  status?: string | undefined;
  q?: string | undefined;
  viewPipeline?: boolean | undefined;
  artistId?: string | undefined;
  saleId?: string | undefined;
  categoryId?: string | undefined;
  sort?: LotSort | undefined;
  lens?: string | undefined;
};

/** Loads artist/sale/category options on demand (Suspense boundary). */
export async function LotFilterOptionsLoader(props: Props) {
  const [artistListResult, salesRows, categoryReader] = await Promise.allSettled([
    getAdminArtistList({ includeArchived: false, limit: 200 }),
    getAdminSalesList({ limit: 200 }),
    getServerCategoryReader().then((r) => r.tree()),
  ]);

  const artists = artistListResult.status === "fulfilled" ? artistListResult.value.rows : [];
  const sales = salesRows.status === "fulfilled" ? salesRows.value.map((r) => r.sale) : [];
  const categories = categoryReader.status === "fulfilled" ? categoryReader.value : [];

  return <LotFilterForm {...props} artists={artists} sales={sales} categories={categories} />;
}

import { MerchandiseListPage } from "@/components/merchandise/merchandise-list-page";
import { parseMerchandiseListSearch } from "@/server/domain/merchandise-list.vm";

export const metadata = { title: "Products" };

export default async function ShopAdminMerchandisePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    cursor?: string | string[];
  }>;
}) {
  return <MerchandiseListPage search={parseMerchandiseListSearch(await searchParams)} />;
}

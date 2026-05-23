import { CategoryLotsTab } from "@/components/admin/category-detail/tabs/children-lots-tabs";
import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import { getAdminLotList } from "@/lib/data/http/admin.server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCategoryLotsPage({ params }: Props) {
  const { id } = await params;
  await loadAdminCategoryDetail(id);
  const lots = await getAdminLotList({ categoryId: id, limit: 50 }).catch(() => []);

  return <CategoryLotsTab lots={lots} />;
}

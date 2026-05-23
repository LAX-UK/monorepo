import { CategoryActivityTab } from "@/components/admin/category-detail/tabs/activity-tab";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCategoryActivityPage({ params }: Props) {
  const { id } = await params;
  return <CategoryActivityTab categoryId={id} />;
}

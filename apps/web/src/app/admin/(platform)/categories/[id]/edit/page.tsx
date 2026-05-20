import { redirect } from "next/navigation";

export default async function EditAdminCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/categories/${id}?tab=edit`);
}

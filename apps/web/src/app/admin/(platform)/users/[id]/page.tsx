import { adminUserDetailPath } from "@/lib/admin/admin-user-redirect";
import { getAdminUserById } from "@/lib/data/http/admin.server";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AdminUsersLegacyDetailPage({ params }: Props) {
  const { id } = await params;
  let user: Awaited<ReturnType<typeof getAdminUserById>> = null;
  try {
    user = await getAdminUserById(id);
  } catch {
    user = null;
  }
  if (!user) notFound();
  redirect(adminUserDetailPath(user.role, user.id));
}

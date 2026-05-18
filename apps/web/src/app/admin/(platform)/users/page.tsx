import { buildAdminUsersLegacyListRedirect } from "@/lib/admin/admin-user-redirect";
import { redirect } from "next/navigation";

export default async function AdminUsersLegacyListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  redirect(buildAdminUsersLegacyListRedirect(sp));
}

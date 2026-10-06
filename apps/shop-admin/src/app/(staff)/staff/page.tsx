import { AdminTable } from "@/components/shop-admin-shell";
import { loadAdminList } from "@/lib/admin-data.server";

export default async function StaffPage() {
  const data = await loadAdminList<{
    items: Array<{ identitySubjectId: string; role: string; disabledAt: string | null }>;
  }>("staff?limit=50");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Staff</h1>
      <AdminTable
        columns={["Subject", "Role", "Status"]}
        rows={
          data?.items.map((row) => [
            row.identitySubjectId.slice(0, 12),
            row.role,
            row.disabledAt ? "disabled" : "active",
          ]) ?? []
        }
      />
    </div>
  );
}

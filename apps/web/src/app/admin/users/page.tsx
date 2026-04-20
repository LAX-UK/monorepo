import { AdminUsersDataTable } from "@/components/admin/admin-users-data-table";
import { Button } from "@/components/ui/button";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminUserList } from "@/lib/data/http/admin.server";
import { EmptyState } from "@auction/ui/components/empty-state";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const q = sp.q?.trim() ?? "";

  let rows: Awaited<ReturnType<typeof getAdminUserList>>["rows"] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const data = await getAdminUserList(q ? { q, limit: 50, offset: 0 } : { limit: 50, offset: 0 });
    rows = data.rows;
    total = data.total;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load users.";
  }

  return (
    <div className="max-w-6xl space-y-8">
      <DisplayHeading as="h1" className="text-4xl">
        Users
      </DisplayHeading>
      {(error || loadError) && (
        <p className="text-sm text-error" role="alert">
          {loadError ?? error}
        </p>
      )}
      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or email"
          className="min-w-[12rem] flex-1 rounded-md border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <p className="font-body text-xs text-on-surface-variant">Total: {total}</p>
      {rows.length === 0 && !loadError ? (
        <EmptyState
          title="No users"
          description="Try a different search query or clear the filter."
        />
      ) : (
        <AdminUsersDataTable rows={rows} />
      )}
    </div>
  );
}

import { AdminUsersDataTable } from "@/components/admin/admin-users-data-table";
import { Button } from "@/components/ui/button";
import { TableScroll } from "@/components/ui/table-scroll";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminUserList } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Toolbar } from "@auction/ui/components/toolbar";

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
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-8">
      <DisplayHeading as="h1" className="text-4xl text-brand-900 dark:text-on-surface">
        Users
      </DisplayHeading>

      {error || loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load users</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      {!loadError ? (
        <Toolbar
          className="flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
          filters={
            <form
              method="get"
              className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <div className="grid min-w-0 flex-1 gap-1 sm:min-w-[16rem]">
                <label
                  htmlFor="admin-users-q"
                  className="font-label text-xs uppercase tracking-widest text-secondary"
                >
                  Search
                </label>
                <input
                  id="admin-users-q"
                  name="q"
                  defaultValue={q}
                  placeholder="Name or email"
                  className="rounded-md border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
                />
              </div>
              <Button type="submit" variant="secondary" className="w-full sm:w-auto">
                Search
              </Button>
            </form>
          }
        />
      ) : null}

      {!loadError ? (
        <p className="font-body text-xs text-on-surface-variant">Total: {total}</p>
      ) : null}

      {!loadError && rows.length === 0 ? (
        <EmptyState
          title="No users"
          description="Try a different search query or clear the filter."
        />
      ) : null}

      {!loadError && rows.length > 0 ? (
        <TableScroll>
          <AdminUsersDataTable rows={rows} />
        </TableScroll>
      ) : null}
    </div>
  );
}

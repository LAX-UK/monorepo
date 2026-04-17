import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { DisplayHeading } from "@/components/ui/typography";
import {
  adminSetUserRoleAction,
  adminSuspendUserAction,
  adminUnsuspendUserAction,
} from "@/lib/actions/admin";
import { getAdminUserList } from "@/lib/data/http/admin.server";

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
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Email</TableHeaderCell>
            <TableHeaderCell>Role</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell className="text-right">Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell className="max-w-[14rem] truncate text-xs">{u.email}</TableCell>
              <TableCell>
                <form action={adminSetUserRoleAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="userId" value={u.id} />
                  <select
                    name="role"
                    defaultValue={u.role}
                    className="rounded border border-outline-variant/20 bg-surface-container-lowest px-2 py-1 text-xs"
                  >
                    <option value="buyer">buyer</option>
                    <option value="seller">seller</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    type="submit"
                    className="font-label text-[10px] uppercase tracking-widest text-primary underline-offset-2 hover:underline"
                  >
                    Save
                  </button>
                </form>
              </TableCell>
              <TableCell className="text-xs">
                {u.suspendedAt ? <span className="text-error">Suspended</span> : "Active"}
              </TableCell>
              <TableCell className="text-right text-xs">
                {u.suspendedAt ? (
                  <form action={adminUnsuspendUserAction} className="inline">
                    <input type="hidden" name="userId" value={u.id} />
                    <button
                      type="submit"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Unsuspend
                    </button>
                  </form>
                ) : (
                  <form action={adminSuspendUserAction} className="inline">
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="reason" value="Admin action" />
                    <button type="submit" className="text-error underline-offset-2 hover:underline">
                      Suspend
                    </button>
                  </form>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

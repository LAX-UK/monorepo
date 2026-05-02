import { AdminUsersBoard, type AdminUsersKpiStrip } from "@/components/admin/admin-users-board";
import { getAdminUserList } from "@/lib/data/http/admin.server";
import { type UserRole, userRoles } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Input } from "@auction/ui/components/input";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

function adminUsersHref(parts: { q?: string; role?: UserRole; suspended?: boolean }) {
  const p = new URLSearchParams();
  if (parts.q != null && parts.q !== "") p.set("q", parts.q);
  if (parts.role) p.set("role", parts.role);
  if (parts.suspended) p.set("suspended", "1");
  const s = p.toString();
  return s ? `/admin/users?${s}` : "/admin/users";
}

function isUserRole(s: string | undefined): s is UserRole {
  return s != null && (userRoles as readonly string[]).includes(s);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; role?: string; suspended?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const q = sp.q?.trim() ?? "";
  const roleFilter = isUserRole(sp.role) ? sp.role : undefined;
  const suspendedOnly = sp.suspended === "1";

  let rawRows: Awaited<ReturnType<typeof getAdminUserList>>["rows"] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const data = await getAdminUserList(
      q ? { q, limit: 100, offset: 0 } : { limit: 100, offset: 0 },
    );
    rawRows = data.rows;
    total = data.total;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load users.";
  }

  const kpis: AdminUsersKpiStrip = {
    totalMatches: total,
    adminsOnPage: rawRows.filter((r) => r.role === "administrator").length,
    suspendedOnPage: rawRows.filter((r) => r.suspendedAt).length,
    pageCount: rawRows.length,
  };

  let rows = rawRows;
  if (roleFilter) rows = rows.filter((r) => r.role === roleFilter);
  if (suspendedOnly) rows = rows.filter((r) => r.suspendedAt);

  const chipCommon = (extra: { role?: UserRole; suspended?: boolean }) =>
    adminUsersHref({
      ...(q !== "" ? { q } : {}),
      ...extra,
    });

  const roleChips = (
    <fieldset className="flex min-w-0 flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Filter by role</legend>
      <Link
        href={chipCommon({ suspended: suspendedOnly })}
        className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
          !roleFilter
            ? "bg-primary text-on-primary ring-primary"
            : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
        }`}
      >
        All roles
      </Link>
      {userRoles.map((role) => (
        <Link
          key={role}
          href={chipCommon({ role, suspended: suspendedOnly })}
          className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
            roleFilter === role
              ? "bg-primary text-on-primary ring-primary"
              : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
          }`}
        >
          {role === "administrator"
            ? "Administrators"
            : role === "accountant"
              ? "Accountants"
              : "Clients"}
        </Link>
      ))}
      <Link
        href={
          suspendedOnly
            ? chipCommon({ ...(roleFilter ? { role: roleFilter } : {}) })
            : chipCommon({ ...(roleFilter ? { role: roleFilter } : {}), suspended: true })
        }
        className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
          suspendedOnly
            ? "bg-primary text-on-primary ring-primary"
            : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
        }`}
      >
        {suspendedOnly ? "Suspended only ✓" : "Suspended only"}
      </Link>
    </fieldset>
  );

  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-8">
      <PageHeader
        title="Users"
        description="Search the directory, filter by role or suspension, and open the drawer for touch-friendly account controls."
      />

      {error || loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load users</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      {!loadError ? (
        <form
          method="get"
          className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          {roleFilter ? <input type="hidden" name="role" value={roleFilter} /> : null}
          {suspendedOnly ? <input type="hidden" name="suspended" value="1" /> : null}
          <div className="grid min-w-0 flex-1 gap-1">
            <label
              htmlFor="admin-users-server-q"
              className="font-label text-xs uppercase tracking-widest text-secondary"
            >
              Server search
            </label>
            <Input
              id="admin-users-server-q"
              name="q"
              defaultValue={q}
              placeholder="Name or email"
              className="min-h-11 text-base md:text-sm"
            />
          </div>
          <Button
            type="submit"
            className="min-h-11 rounded-md bg-primary px-6 font-label text-xs font-semibold uppercase tracking-widest text-on-primary"
          >
            Search
          </Button>
        </form>
      ) : null}

      {!loadError && rows.length === 0 ? (
        <EmptyState title="No users" description="Try a different search query or clear filters." />
      ) : null}

      {!loadError && rows.length > 0 ? (
        <AdminUsersBoard rows={rows} kpis={kpis} roleChips={roleChips} />
      ) : null}
    </div>
  );
}

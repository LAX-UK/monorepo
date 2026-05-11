import { AdminUsersBoard, type AdminUsersKpiStrip } from "@/components/admin/admin-users-board";
import { AdminUsersSearchForm } from "@/components/admin/admin-users-search-form";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { ResetFiltersLink } from "@/components/admin/reset-filters-link";
import { ShareFiltersButton } from "@/components/admin/share-filters-button";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { getAdminUserList } from "@/lib/data/http/admin.server";
import { type UserRole, userRoles } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";

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
    <FilterChipRow
      label="Filter by role"
      chips={[
        {
          id: "all",
          label: "All roles",
          href: chipCommon({ suspended: suspendedOnly }),
          active: !roleFilter,
        },
        ...userRoles.map((role) => ({
          id: role,
          label:
            role === "administrator"
              ? "Administrators"
              : role === "accountant"
                ? "Accountants"
                : "Clients",
          href: chipCommon({ role, suspended: suspendedOnly }),
          active: roleFilter === role,
        })),
        {
          id: "suspended",
          label: suspendedOnly ? "Suspended only" : "Suspended only",
          href: suspendedOnly
            ? chipCommon({ ...(roleFilter ? { role: roleFilter } : {}) })
            : chipCommon({ ...(roleFilter ? { role: roleFilter } : {}), suspended: true }),
          active: suspendedOnly,
        },
      ]}
    />
  );

  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Users"
        description="Search the directory, filter by role or suspension, and open the drawer for touch-friendly account controls."
        actions={
          <div className="flex flex-wrap gap-2">
            <ShareFiltersButton />
            <ResetFiltersLink
              active={Boolean(q || roleFilter || suspendedOnly)}
              href="/admin/users"
            />
          </div>
        }
      />

      {error || loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load users</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      {!loadError ? (
        <AdminUsersSearchForm initialQ={q} roleFilter={roleFilter} suspendedOnly={suspendedOnly} />
      ) : null}

      {!loadError && rows.length === 0 ? (
        <EmptyState title="No users" description="Try a different search query or clear filters." />
      ) : null}

      {!loadError && rows.length > 0 ? (
        <AdminUsersBoard rows={rows} kpis={kpis} roleChips={roleChips} />
      ) : null}
    </AppScreen>
  );
}

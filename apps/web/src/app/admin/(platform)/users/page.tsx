import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminUsersBoard, type AdminUsersKpiStrip } from "@/components/admin/admin-users-board";
import { AdminUsersSearchForm } from "@/components/admin/admin-users-search-form";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { usersListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { type UserRole, userRoles } from "@auction/types";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";

function isUserRole(s: string | undefined): s is UserRole {
  return s != null && (userRoles as readonly string[]).includes(s);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    q?: string;
    role?: string;
    suspended?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = usersListController.parseQuery(sp);

  let rows: AdminUserRow[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const result = await usersListController.fetch(query);
    rows = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load users.";
  }

  const roleFilter = isUserRole(query.role) ? query.role : undefined;
  const suspendedOnly = query.suspendedOnly ?? false;
  const q = query.q ?? "";

  const kpis: AdminUsersKpiStrip = {
    totalMatches: total,
    adminsOnPage: rows.filter((r) => r.role === "staff").length,
    suspendedOnPage: rows.filter((r) => r.suspendedAt).length,
    pageCount: rows.length,
  };

  const chip = (patch: Record<string, string | number | boolean | undefined | null | "">) =>
    buildListHref("/admin/users", sp, { ...patch, offset: 0 });

  const roleChips = (
    <FilterChipRow
      label="Filter by role"
      chips={[
        {
          id: "all",
          label: "All roles",
          href: chip({ role: "" }),
          active: !roleFilter,
        },
        ...userRoles.map((role) => ({
          id: role,
          label: role === "staff" ? "Staff" : "Clients",
          href: chip({ role }),
          active: roleFilter === role,
        })),
        {
          id: "suspended",
          label: "Suspended only",
          href: suspendedOnly ? chip({ suspended: false }) : chip({ suspended: true }),
          active: suspendedOnly,
        },
      ]}
    />
  );

  const hasFilters = Boolean(q || roleFilter || suspendedOnly);

  const pagination =
    !loadError && total > 0 ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        total={total}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/users", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/users", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  return (
    <AdminListPage
      title="Users"
      description="Search the directory, filter by role or suspension, and open the drawer for touch-friendly account controls."
      hasFilters={hasFilters}
      resetHref="/admin/users"
      errorAlert={
        error || loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load users</AlertTitle>
            <AlertDescription>{loadError ?? error}</AlertDescription>
          </Alert>
        ) : null
      }
      chips={roleChips}
      filters={
        !loadError ? (
          <AdminUsersSearchForm
            initialQ={q}
            roleFilter={roleFilter}
            suspendedOnly={suspendedOnly}
          />
        ) : null
      }
      view={!loadError && rows.length > 0 ? <AdminUsersBoard rows={rows} kpis={kpis} /> : null}
      empty={
        !loadError && rows.length === 0 ? (
          <EmptyState
            title="No users"
            description="Try a different search query or clear filters."
          />
        ) : null
      }
      pagination={pagination}
    />
  );
}

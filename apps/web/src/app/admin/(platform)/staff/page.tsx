import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminStaffBoard } from "@/components/admin/admin-staff-board";
import { AdminStaffSearchForm } from "@/components/admin/admin-staff-search-form";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { usersListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import { type UserStaffRole, userStaffRoles } from "@auction/types";
import { PaginationFooter } from "@auction/ui";

function isStaffRole(s: string | undefined): s is UserStaffRole {
  return s != null && (userStaffRoles as readonly string[]).includes(s);
}

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    q?: string;
    staffRole?: string;
    suspended?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = usersListController.parseQuery({ ...sp, role: "staff" });

  let rows: AdminUserRow[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const result = await usersListController.fetch({ ...query, role: "staff" });
    rows = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load staff.";
  }

  const staffRoleFilter = isStaffRole(query.staffRole) ? query.staffRole : undefined;
  const suspendedOnly = query.suspendedOnly ?? false;
  const q = query.q ?? "";

  const activeOnPage = rows.filter((r) => !r.suspendedAt).length;
  const suspendedOnPage = rows.filter((r) => r.suspendedAt).length;

  const chip = (patch: Record<string, string | number | boolean | undefined | null | "">) =>
    buildListHref("/admin/staff", sp, { ...patch, offset: 0 });

  const roleCounts = new Map<string, number>();
  for (const r of rows) {
    const key = r.staffRole ?? "legacy";
    roleCounts.set(key, (roleCounts.get(key) ?? 0) + 1);
  }

  const staffRoleChips = (
    <FilterChipRow
      label="Staff role"
      chips={[
        {
          id: "all-roles",
          label: "All roles",
          href: chip({ staffRole: "" }),
          active: !staffRoleFilter,
        },
        ...userStaffRoles.map((role) => ({
          id: role,
          label: staffRoleLabel(role),
          href: chip({ staffRole: role }),
          active: staffRoleFilter === role,
        })),
      ]}
    />
  );

  const suspendedChip = (
    <FilterChipRow
      label="Status"
      chips={[
        {
          id: "all",
          label: "All staff",
          href: chip({ suspended: false }),
          active: !suspendedOnly,
        },
        {
          id: "suspended",
          label: "Suspended only",
          href: suspendedOnly ? chip({ suspended: false }) : chip({ suspended: true }),
          active: suspendedOnly,
        },
      ]}
    />
  );

  const roleBreakdown =
    rows.length > 0 ? (
      <p className="mb-4 font-body text-xs text-on-surface-variant">
        On this page:{" "}
        {[...roleCounts.entries()]
          .map(
            ([role, n]) =>
              `${staffRoleLabel(role === "legacy" ? null : (role as UserStaffRole))}: ${n}`,
          )
          .join(" · ")}
      </p>
    ) : null;

  const hasFilters = Boolean(q || staffRoleFilter || suspendedOnly);

  const pagination =
    !loadError && total > 0 ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        total={total}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/staff", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/staff", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  return (
    <AdminListPage
      title="Staff"
      description="Internal team directory. Filter by staff role or suspension, and manage capabilities from each profile."
      hasFilters={hasFilters}
      resetHref="/admin/staff"
      kpiStrip={
        !loadError ? (
          <AdminListKpiStrip
            ariaLabel="Staff summary"
            tiles={[
              { label: "Total staff", value: total, delta: `${rows.length} on page` },
              { label: "Active", value: activeOnPage, delta: "Current page" },
              { label: "Suspended", value: suspendedOnPage, delta: "Current page" },
              {
                label: "Roles on page",
                value: new Set(rows.map((r) => r.staffRole ?? "legacy")).size,
                delta: "Distinct staff roles",
              },
            ]}
          />
        ) : null
      }
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not load staff">{loadError ?? error}</AdminListAlert>
        ) : null
      }
      chips={
        <div className="space-y-3">
          {staffRoleChips}
          {suspendedChip}
        </div>
      }
      filters={
        !loadError ? (
          <AdminStaffSearchForm
            initialQ={q}
            staffRoleFilter={staffRoleFilter}
            suspendedOnly={suspendedOnly}
          />
        ) : null
      }
      view={
        !loadError && rows.length > 0 ? (
          <AdminStaffBoard rows={rows} totalMatches={total} roleBreakdown={roleBreakdown} />
        ) : null
      }
      empty={
        !loadError && rows.length === 0 ? (
          <AdminEmptyState
            title="No staff"
            description="Try a different search query or clear filters."
          />
        ) : null
      }
      showCommandPaletteHint={!loadError && rows.length === 0}
      pagination={pagination}
    />
  );
}

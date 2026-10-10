import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { CatalogDetailTabCard } from "@/components/admin/catalog";
import { ShopStaffAccessControl } from "@/components/admin/people/shop-staff-access-control";
import { UserStaffRoleAction } from "@/components/admin/user-actions";
import {
  pendingChangeLabel,
  staffRoleOnPlatformLabel,
} from "@/lib/admin/people/staff-access-presenter";
import type { StaffAccessDetail } from "@/lib/data/http/staff-access.server";
import { laxStaffPlatform } from "@auction/types";

type Props = {
  userId: string;
  detail: StaffAccessDetail | null;
  canManage: boolean;
  bidStaffRole: string | null;
};

/** What this person can do on each LAX platform, with who changed it (D36). */
export function StaffLaxAccessPanel({ userId, detail, canManage, bidStaffRole }: Props) {
  if (!detail) {
    return (
      <AdminEmptyState
        title="LAX access unavailable"
        description="We couldn't load access across LAX platforms. Refresh to try again."
      />
    );
  }

  return (
    <div className="space-y-6">
      {detail.platforms.map((view) => {
        const platform = laxStaffPlatform(view.product);
        return (
          <CatalogDetailTabCard
            key={view.product}
            title={platform.label}
            description={platform.description}
          >
            <div className="space-y-3 text-sm">
              <p>
                {view.role ? (
                  <span className="font-medium text-on-surface">
                    {staffRoleOnPlatformLabel(view.product, view.role)}
                  </span>
                ) : (
                  <span className="text-on-surface-variant">No access</span>
                )}
              </p>
              {view.pending ? (
                <p className="text-xs text-secondary">
                  {pendingChangeLabel(view.product, view.pending)}
                </p>
              ) : null}
              {canManage && view.product === "bid" ? (
                <UserStaffRoleAction userId={userId} defaultStaffRole={bidStaffRole} />
              ) : null}
              {canManage && view.product === "shop" ? (
                <ShopStaffAccessControl
                  userId={userId}
                  currentRole={view.pending?.action === "granted" ? view.pending.role : view.role}
                />
              ) : null}
            </div>
          </CatalogDetailTabCard>
        );
      })}

      <CatalogDetailTabCard
        title="Access history"
        description="Grants and removals on every platform"
      >
        {detail.history.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No changes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border-hairline text-sm">
            {detail.history.map((entry, index) => (
              <li
                key={`${entry.at}-${entry.product}-${index}`}
                className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  {laxStaffPlatform(entry.product).label}:{" "}
                  {entry.action === "granted" && entry.role
                    ? `given ${staffRoleOnPlatformLabel(entry.product, entry.role)}`
                    : "access removed"}{" "}
                  <span className="text-on-surface-variant">
                    by {entry.actorName ?? "a LAX admin"}
                    {entry.viaInvitation ? " (invitation)" : ""}
                  </span>
                </span>
                <AdminTableDateTimeCell iso={entry.at} mode="timestamp" />
              </li>
            ))}
          </ul>
        )}
      </CatalogDetailTabCard>
    </div>
  );
}

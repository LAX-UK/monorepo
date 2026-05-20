import {
  KpiStackRail,
  QuickActionsRail,
  RelatedEntitiesRail,
} from "@/components/admin/detail-rail";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";

type Props = {
  user: AdminUserDetailPayload;
  lifetimeSpend?: number | null | undefined;
  lotsWon?: number | undefined;
  submissionsCount?: number | null | undefined;
  legalEntities?: { id: string; displayName: string }[];
};

export function UserDetailContextRail({
  user,
  lifetimeSpend,
  lotsWon,
  submissionsCount,
  legalEntities = [],
}: Props) {
  const isStaff = user.role === "staff";

  return (
    <div className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5">
      <KpiStackRail
        title={isStaff ? "Staff" : "Client"}
        items={[
          ...(lifetimeSpend != null
            ? [{ id: "spend", label: "Lifetime spend", value: String(lifetimeSpend) }]
            : []),
          ...(lotsWon != null ? [{ id: "won", label: "Lots won", value: String(lotsWon) }] : []),
          ...(submissionsCount != null
            ? [{ id: "submissions", label: "Submissions", value: String(submissionsCount) }]
            : []),
          {
            id: "role",
            label: "Role",
            value: isStaff
              ? staffRoleLabel((user.staffRole as UserStaffRole | null) ?? null)
              : "Client",
          },
        ]}
      />
      {!isStaff ? (
        <QuickActionsRail
          actions={[
            {
              id: "impersonate",
              label: "Impersonate",
              href: `/admin/impersonation?userId=${user.id}`,
              variant: "outline",
            },
          ]}
        />
      ) : null}
      {legalEntities.length > 0 ? (
        <RelatedEntitiesRail
          title="Legal entities"
          items={legalEntities.map((e) => ({
            id: e.id,
            kind: "Entity",
            label: e.displayName,
            href: `/admin/legal-entities/${e.id}`,
          }))}
        />
      ) : null}
    </div>
  );
}

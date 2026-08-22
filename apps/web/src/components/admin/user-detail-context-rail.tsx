"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  KpiStackRail,
  type QuickActionItem,
  QuickActionsRail,
} from "@/components/admin/detail-rail";
import type { UserDetailRailContext } from "@/lib/admin/admin-user-readiness.vm";
import { kycStatusLabel } from "@/lib/admin/status-badge-variants";
import { startAdminImpersonationAfterLookup } from "@/lib/legal-entity/acting-context.actions";
import { notify } from "@/lib/ui/notify";
import type { LegalEntity } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

type Props = {
  email: string;
  legalEntities?: Pick<LegalEntity, "id" | "displayName">[];
  context?: UserDetailRailContext;
};

export function UserDetailContextRail({ email, legalEntities = [], context }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const impersonate = useCallback(
    (legalEntityId: string) => {
      startTransition(() => {
        void (async () => {
          const r = await startAdminImpersonationAfterLookup(legalEntityId);
          if (r.ok) {
            notify.success("Impersonation started");
            router.push("/dashboard");
            router.refresh();
            return;
          }
          notify.error(r.message ?? "Could not start impersonation");
        })();
      });
    },
    [router],
  );

  const actions = useMemo((): QuickActionItem[] => {
    const copyEmail: QuickActionItem = {
      id: "copy-email",
      label: "Copy email",
      variant: "outline",
      icon: <Mail className="size-3.5" aria-hidden />,
      onClick: () => {
        void navigator.clipboard.writeText(email).then(() => notify.success("Email copied"));
      },
    };

    if (legalEntities.length === 0) {
      return [copyEmail];
    }

    const primary = legalEntities[0];
    if (!primary) {
      return [copyEmail];
    }

    const primaryAction: QuickActionItem = {
      id: `impersonate-${primary.id}`,
      label: `Impersonate · ${primary.displayName}`,
      variant: "default",
      disabled: pending,
      onClick: () => impersonate(primary.id),
    };

    return [primaryAction, copyEmail];
  }, [email, impersonate, legalEntities, pending]);

  const additionalEntities = legalEntities.slice(1);

  const statusItems = context
    ? [
        {
          id: "kyc",
          label: "KYC",
          value: kycStatusLabel(context.kycStatus),
          tone:
            context.kycStatus === "approved"
              ? ("success" as const)
              : context.kycStatus === "rejected"
                ? ("danger" as const)
                : ("warning" as const),
        },
        {
          id: "email",
          label: "Email",
          value: context.emailVerified ? "Verified" : "Unverified",
          tone: context.emailVerified ? ("success" as const) : ("warning" as const),
        },
        ...(context.canViewAml
          ? [
              {
                id: "aml",
                label: "AML",
                value: context.amlHoldActive
                  ? "Hold active"
                  : context.amlReviewPending
                    ? "Review pending"
                    : "Clear",
                tone: context.amlHoldActive
                  ? ("danger" as const)
                  : context.amlReviewPending
                    ? ("warning" as const)
                    : ("success" as const),
              },
            ]
          : []),
        ...(context.connectGapsCount > 0
          ? [
              {
                id: "connect",
                label: "Seller setup",
                value: `${context.connectGapsCount} gap${context.connectGapsCount === 1 ? "" : "s"}`,
                tone: "warning" as const,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="space-y-4 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5">
      {context ? (
        <div className="space-y-3">
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Status
          </p>
          <div className="flex flex-wrap gap-2">
            <AdminStatusBadge domain="kyc" status={context.kycStatus} size="sm" />
            <AdminStatusBadge
              domain="kyc"
              status={context.emailVerified ? "approved" : "pending"}
              label={context.emailVerified ? "Email verified" : "Email unverified"}
              size="sm"
            />
            {context.amlHoldActive ? (
              <AdminStatusBadge domain="amlHold" status="active" label="AML hold" size="sm" />
            ) : null}
            {context.canViewAml && context.amlReviewPending ? (
              <AdminStatusBadge
                domain="amlDecision"
                status="pending"
                label="AML review"
                size="sm"
              />
            ) : null}
          </div>
          <KpiStackRail title="At a glance" items={statusItems} />
          {context.primaryEntity ? (
            <p className="font-body text-sm text-on-surface-variant">
              Primary seller entity:{" "}
              <Link
                href={`/admin/legal-entities/${context.primaryEntity.id}`}
                className="text-link hover:underline"
              >
                {context.primaryEntity.displayName}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      <QuickActionsRail actions={actions} />
      {legalEntities.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">
          No seller entity available for impersonation.
        </p>
      ) : null}
      {additionalEntities.length > 0 ? (
        <div className="space-y-2 border-t border-border-hairline pt-3">
          <p className="font-label text-[10px] uppercase text-on-surface-variant">Impersonate as</p>
          <ul className="space-y-1">
            {additionalEntities.map((entity) => (
              <li key={entity.id}>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => impersonate(entity.id)}
                  className="h-auto w-full justify-start px-2 py-1.5 font-body text-sm text-on-surface"
                >
                  {entity.displayName}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

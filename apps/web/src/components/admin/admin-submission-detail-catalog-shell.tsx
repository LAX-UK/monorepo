"use client";

import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import type { CatalogMobileAction } from "@/components/admin/catalog/catalog-mobile-action-bar";
import { adminStartSubmissionReviewResultAction } from "@/lib/actions/admin-submissions";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { adminStatusLabel, adminStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import { notify } from "@/lib/ui/notify";
import type { ItemSubmissionStatus } from "@auction/types";
import { StatusBadge } from "@auction/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useTransition } from "react";

type Props = {
  submissionId: string;
  title: string;
  status: ItemSubmissionStatus;
  children: ReactNode;
};

export function AdminSubmissionDetailCatalogShell({
  submissionId,
  title,
  status,
  children,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const mobileActions = useMemo((): CatalogMobileAction[] => {
    const back: CatalogMobileAction = {
      id: "back-queue",
      label: "Queue",
      variant: "secondary",
      href: "/admin/submissions",
    };

    if (status === "submitted") {
      return [
        back,
        {
          id: "start-review",
          label: "Start review",
          variant: "primary",
          disabled: pending,
          onClick: () => {
            startTransition(() => {
              void (async () => {
                const r = await adminStartSubmissionReviewResultAction(submissionId);
                if (r.ok) {
                  notify.success("Review started");
                  router.refresh();
                  return;
                }
                notify.error(r.error);
              })();
            });
          },
        },
      ];
    }

    if (status === "under_review") {
      return [
        {
          id: "approve",
          label: "Approve",
          variant: "primary",
          htmlForm: CATALOG_FORM_IDS.submissionApprove,
        },
        {
          id: "reject",
          label: "Reject",
          variant: "secondary",
          htmlForm: CATALOG_FORM_IDS.submissionReject,
        },
        back,
      ];
    }

    return [back];
  }, [status, submissionId, pending, router]);

  return (
    <CatalogFormShell
      className="max-w-7xl"
      breadcrumbs={
        <Link
          href="/admin/submissions"
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← Submissions
        </Link>
      }
      title={
        <span className="flex flex-wrap items-center gap-3">
          <span>{title}</span>
          <StatusBadge variant={adminStatusToBadgeVariant("submission", status)} size="sm">
            {adminStatusLabel("submission", status)}
          </StatusBadge>
        </span>
      }
      mobileActions={mobileActions}
    >
      {children}
    </CatalogFormShell>
  );
}

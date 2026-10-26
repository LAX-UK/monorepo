"use client";

import { useLegalEntityActions } from "@/components/admin/legal-entities/legal-entity-actions";
import { LegalEntityDetailAlerts } from "@/components/admin/legal-entities/legal-entity-detail-alerts";
import { StaffDetailTabs } from "@/components/admin/staff/staff-detail-tabs";
import { usePinPageAction } from "@/components/admin/staff/use-pin-page-action";
import { buildLegalEntityDetailTabSpecs } from "@/lib/admin/catalog/detail-tab-compat";
import { formatLegalEntityKindSubkind } from "@/lib/admin/legal-entity-list-presenter";
import type { AdminLegalEntityDetailBundle } from "@/lib/admin/load-admin-legal-entity-detail";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { stripeRequirementsAttentionCountForEntity } from "@/lib/admin/stripe-connect-staff-presenter";
import {
  DetailPage,
  MetaItem,
  Notice,
  type OverflowAction,
  OverflowMenu,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  StatusBadge,
} from "@auction/staff-ui";
import { AlertTriangle, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  bundle: AdminLegalEntityDetailBundle;
  backHref: string;
  saleCount?: number;
  children: ReactNode;
};

/**
 * A legal entity's page on the staff record template: its name and lifecycle status, what kind of
 * organisation it is and how far Stripe Connect has got, impersonation as the one secondary
 * action, a notice when Stripe still needs something, and its sections as tabs. Messages from an
 * action that redirected back here show above the section.
 */
export function LegalEntityDetailShell({ bundle, backHref, saleCount = 0, children }: Props) {
  const { entity, documents } = bundle;
  const pendingDocCount = documents.filter((d) => d.reviewStatus === "pending").length;
  const stripeDueCount = stripeRequirementsAttentionCountForEntity(entity);
  const status = staffStatus("legalEntity", entity.status);
  const pin = usePinPageAction(entity.displayName);
  const actions = useLegalEntityActions();

  const tabs = buildLegalEntityDetailTabSpecs({
    entityId: entity.id,
    pendingDocCount,
    stripeDueCount,
    saleCount,
  }).map((tab) => ({
    id: tab.id,
    label: typeof tab.label === "string" ? tab.label : tab.id,
    href: tab.href,
    ...(tab.count !== undefined ? { count: tab.count } : {}),
  }));

  const stripe = entity.stripeConnectAccountId
    ? entity.stripeConnectPayoutsEnabled
      ? "Payouts enabled"
      : "Payout setup in progress"
    : "Not connected";

  const overflow: OverflowAction[] = [
    pin,
    {
      id: "onboarding",
      label: "Onboarding issues",
      href: "/admin/onboarding-issues?tab=entities",
    },
  ];

  const target = {
    id: entity.id,
    name: entity.displayName,
    kind: formatLegalEntityKindSubkind(entity.kind, entity.subkind),
    statusPresentation: status,
  };

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Legal entities", href: backHref }, { label: entity.displayName }]}
          />
        }
        title={entity.displayName}
        status={
          <StatusBadge tone={status.tone} live={status.live ?? false}>
            {status.label}
          </StatusBadge>
        }
        meta={
          <>
            <MetaItem label="Kind">
              {formatLegalEntityKindSubkind(entity.kind, entity.subkind)}
            </MetaItem>
            <MetaItem label="Stripe Connect">{stripe}</MetaItem>
          </>
        }
        secondaryActions={
          <StaffButton
            variant="secondary"
            icon={<UserRoundCog aria-hidden />}
            onClick={() => actions.impersonate(target)}
          >
            Impersonate
          </StaffButton>
        }
        overflow={
          <OverflowMenu label="More legal entity actions" Link={NextLink} actions={overflow} />
        }
        notice={
          stripeDueCount > 0 ? (
            <Notice
              tone="warning"
              title="Stripe still needs information from this organisation"
              actions={
                <StaffButton
                  asChild
                  size="sm"
                  variant="secondary"
                  icon={<AlertTriangle aria-hidden />}
                >
                  <Link href={`/admin/legal-entities/${entity.id}/stripe`}>Open Stripe tab</Link>
                </StaffButton>
              }
            >
              Payouts stay off until the outstanding requirements are met.
            </Notice>
          ) : null
        }
        tabs={<StaffDetailTabs label="Legal entity sections" items={tabs} />}
      >
        <Suspense fallback={null}>
          <LegalEntityDetailAlerts />
        </Suspense>
        {children}
      </DetailPage>
      {actions.dialogs}
    </>
  );
}

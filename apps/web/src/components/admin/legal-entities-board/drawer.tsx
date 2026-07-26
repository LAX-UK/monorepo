"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { LegalEntityHealthPanel } from "@/components/admin/legal-entities/legal-entity-health-panel";
import { LegalEntityImpersonationButton } from "@/components/admin/legal-entities/legal-entity-impersonation-button";
import { LegalEntitySummaryStrip } from "@/components/admin/legal-entities/legal-entity-summary-strip";
import { formatLegalEntityKindSubkind } from "@/lib/admin/legal-entity-list-presenter";
import type { AdminLegalEntityDetailBundle } from "@/lib/admin/load-admin-legal-entity-detail";
import { buildPeopleDetailHref } from "@/lib/admin/people/people-detail-href";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  detail: AdminLegalEntityDetailBundle;
  listReturnTarget?: string | undefined;
};

export function LegalEntityDrawerContent({ detail, listReturnTarget }: Props) {
  const { entity, creator, documents, health, canViewOwner, canViewDocuments } = detail;
  const pendingDocCount = documents.filter((doc) => doc.reviewStatus === "pending").length;

  return (
    <div className="space-y-6">
      <LegalEntitySummaryStrip entity={entity} />
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge domain="legalEntity" status={entity.status} size="md" />
        <span className="font-body text-xs text-on-surface-variant">
          {formatLegalEntityKindSubkind(entity.kind, entity.subkind)}
        </span>
      </div>

      <LegalEntityHealthPanel health={health} />

      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Updated</dt>
          <dd>{formatDateTime(entity.updatedAt)}</dd>
        </div>
        {canViewOwner && creator ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Created by</dt>
            <dd>
              <Link href={`/admin/clients/${creator.id}`} className="text-link hover:underline">
                {creator.name}
              </Link>
              <span className="mt-0.5 block truncate text-on-surface-variant">{creator.email}</span>
            </dd>
          </div>
        ) : null}
        {canViewDocuments ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Documents</dt>
            <dd>
              {documents.length === 0
                ? "None uploaded"
                : `${documents.length} on file${pendingDocCount > 0 ? ` · ${pendingDocCount} pending review` : ""}`}
            </dd>
          </div>
        ) : null}
      </dl>

      <AdminTechnicalIdDisclosure items={[{ label: "Legal entity ID", value: entity.id }]} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <LegalEntityImpersonationButton
          legalEntityId={entity.id}
          displayName={entity.displayName}
          className="min-h-11"
        />
        <Button variant="outline" size="sm" className="min-h-11" asChild>
          <Link
            href={buildPeopleDetailHref(`/admin/legal-entities/${entity.id}`, listReturnTarget)}
          >
            Open full record
          </Link>
        </Button>
        {entity.stripeConnectRequirementsCurrentlyDue.length > 0 ? (
          <Button variant="ghost" size="sm" className="min-h-11" asChild>
            <Link href={`/admin/legal-entities/${entity.id}?tab=stripe`}>Stripe tab</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

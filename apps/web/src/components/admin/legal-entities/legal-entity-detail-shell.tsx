import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { LegalEntityDetailContextRail } from "@/components/admin/legal-entities/legal-entity-detail-context-rail";
import { LegalEntityDetailTabs } from "@/components/admin/legal-entities/legal-entity-detail-tabs";
import { LegalEntitySummaryStrip } from "@/components/admin/legal-entities/legal-entity-summary-strip";
import { formatLegalEntityKindSubkind } from "@/lib/admin/legal-entity-list-presenter";
import { relativeFromIso } from "@/lib/admin/relative-time";
import type { AdminLegalEntityDocument } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import type { LegalEntity } from "@auction/types";

type CreatorInfo = {
  id: string;
  name: string;
  email: string;
} | null;

type Props = {
  entity: LegalEntity;
  creator: CreatorInfo;
  activeTab: string;
  documents?: AdminLegalEntityDocument[];
  error?: string | null;
  success?: string | null;
};

export function LegalEntityDetailShell({
  entity,
  creator,
  activeTab,
  documents = [],
  error,
  success,
}: Props) {
  return (
    <AdminEntityDetailShell
      detailHeader
      detailHeaderSticky={false}
      backHref="/admin/legal-entities"
      backLabel="Legal entities"
      entityId={entity.id}
      updatedAt={entity.updatedAt}
      title={entity.displayName}
      description={`Legal entity · ${formatLegalEntityKindSubkind(entity.kind, entity.subkind)} · Created ${formatDateTime(entity.createdAt)}`}
      actions={<AdminPinPageButton label={entity.displayName} />}
      meta={
        <div className="space-y-3">
          <LegalEntitySummaryStrip entity={entity} />
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge domain="legalEntity" status={entity.status} size="md" />
            <span className="font-body text-xs text-on-surface-variant">
              Updated {formatDateTime(entity.updatedAt)} (
              {relativeFromIso(entity.updatedAt.toISOString())})
            </span>
          </div>
        </div>
      }
      rail={<LegalEntityDetailContextRail entity={entity} />}
      railSticky={false}
    >
      <LegalEntityDetailTabs
        entity={entity}
        creator={creator}
        activeTab={activeTab}
        documents={documents}
        {...(error != null ? { error } : {})}
        {...(success != null ? { success } : {})}
      />
    </AdminEntityDetailShell>
  );
}

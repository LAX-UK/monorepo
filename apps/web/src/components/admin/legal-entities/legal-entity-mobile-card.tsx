"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { PeopleMobileCard } from "@/components/admin/people/people-mobile-card";
import {
  formatLegalEntityKindSubkind,
  stripeSummaryLabel,
} from "@/lib/admin/legal-entity-list-presenter";
import type { AdminLegalEntityListRow } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";

type Props = {
  entity: AdminLegalEntityListRow;
  onOpen: () => void;
  stripeLens?: boolean;
};

export function LegalEntityMobileCard({ entity, onOpen, stripeLens = false }: Props) {
  return (
    <PeopleMobileCard
      title={entity.displayName}
      subtitle={formatLegalEntityKindSubkind(entity.kind, entity.subkind)}
      onOpen={onOpen}
      badges={
        <>
          <AdminStatusBadge domain="legalEntity" status={entity.status} size="sm" />
          {stripeLens || entity.stripeDueCount > 0 ? (
            <span className="text-[10px] text-on-surface-variant">
              {stripeSummaryLabel(entity.stripeDueCount)}
            </span>
          ) : null}
        </>
      }
      meta={`Updated ${formatDateTime(entity.updatedAt)}`}
    />
  );
}

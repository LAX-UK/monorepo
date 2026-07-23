"use client";

import { LegalEntityMobileCard } from "@/components/admin/legal-entities/legal-entity-mobile-card";
import type { AdminLegalEntityListRow } from "@/lib/data/http/admin-legal-entities.shared";

type Props = {
  rows: AdminLegalEntityListRow[];
  stripeLens?: boolean;
  onOpen: (row: AdminLegalEntityListRow) => void;
};

export function LegalEntitiesBoardMobileCards({ rows, stripeLens = false, onOpen }: Props) {
  return (
    <ul className="space-y-2">
      {rows.map((entity) => (
        <li key={entity.id}>
          <LegalEntityMobileCard
            entity={entity}
            stripeLens={stripeLens}
            onOpen={() => onOpen(entity)}
          />
        </li>
      ))}
    </ul>
  );
}

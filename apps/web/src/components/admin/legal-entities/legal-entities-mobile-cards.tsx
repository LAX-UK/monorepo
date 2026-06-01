"use client";

import { LegalEntityMobileCard } from "@/components/admin/legal-entities/legal-entity-mobile-card";
import type { AdminLegalEntityListRow } from "@/lib/data/http/admin.server";
import { useRouter } from "next/navigation";

type Props = {
  rows: AdminLegalEntityListRow[];
  stripeLens?: boolean;
};

export function LegalEntitiesMobileCards({ rows, stripeLens = false }: Props) {
  const router = useRouter();

  return (
    <ul className="space-y-2">
      {rows.map((entity) => (
        <li key={entity.id}>
          <LegalEntityMobileCard
            entity={entity}
            stripeLens={stripeLens}
            onOpen={() => router.push(`/admin/legal-entities/${entity.id}`)}
          />
        </li>
      ))}
    </ul>
  );
}

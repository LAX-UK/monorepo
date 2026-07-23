"use client";

import { AdminLegalEntitiesBoard } from "@/components/admin/legal-entities-board/index";
import { buildLegalEntitiesDrawerHref } from "@/lib/admin/legal-entities-list-href";
import type { AdminLegalEntityDetailBundle } from "@/lib/admin/load-admin-legal-entity-detail";
import type { AdminLegalEntityListRow } from "@/lib/data/http/admin-legal-entities.shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { LegalEntitiesBoardPagination } from "./index";

type Props = {
  rows: AdminLegalEntityListRow[];
  stripeLens?: boolean;
  selectedEntityId?: string | undefined;
  preview?: AdminLegalEntityDetailBundle | null | undefined;
  listReturnTarget?: string | undefined;
  pagination?: LegalEntitiesBoardPagination | null | undefined;
};

export function AdminLegalEntitiesBoardContainer({
  rows,
  stripeLens = false,
  selectedEntityId,
  preview = null,
  listReturnTarget,
  pagination,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onOpen = useCallback(
    (row: AdminLegalEntityListRow) => {
      router.push(buildLegalEntitiesDrawerHref(searchParams, row.id), { scroll: false });
    },
    [router, searchParams],
  );

  const onCloseDrawer = useCallback(() => {
    router.push(buildLegalEntitiesDrawerHref(searchParams, null), { scroll: false });
  }, [router, searchParams]);

  return (
    <AdminLegalEntitiesBoard
      rows={rows}
      stripeLens={stripeLens}
      selectedEntityId={selectedEntityId}
      preview={preview}
      listReturnTarget={listReturnTarget}
      onOpen={onOpen}
      onCloseDrawer={onCloseDrawer}
      pagination={pagination ?? null}
    />
  );
}

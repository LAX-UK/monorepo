"use client";

import { AdminDisputesBoard } from "@/components/admin/disputes-board";
import { useAdminDisputesPageQuery } from "@/hooks/admin/use-admin-disputes-page-query";
import type { AdminDisputesPageParams } from "@/lib/data/http/disputes.shared";

type Props = {
  params: AdminDisputesPageParams;
};

/** Client container: reads hydrated TanStack Query cache for the disputes table. */
export function AdminDisputesBoardContainer({ params }: Props) {
  const { data } = useAdminDisputesPageQuery(params);

  if (!data) return null;

  return <AdminDisputesBoard rows={data.rows} />;
}

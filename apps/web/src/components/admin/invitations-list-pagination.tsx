"use client";

import { AdminListNuqsPagination } from "@/components/admin/admin-list-nuqs-pagination";
import { useInvitationsListNuqs } from "@/lib/admin/invitations-list-nuqs";
import { useTransition } from "react";

type Props = {
  offset: number;
  limit: number;
  countOnPage: number;
  total: number;
};

/** Invitations pagination driven by nuqs (`offset`/`limit`, shallow:false). */
export function InvitationsListPagination({ offset, limit, countOnPage, total }: Props) {
  const [, setFilters] = useInvitationsListNuqs();
  const [pending, startTransition] = useTransition();

  return (
    <AdminListNuqsPagination
      offset={offset}
      countOnPage={countOnPage}
      total={total}
      pending={pending}
      onPrev={() => {
        startTransition(() => {
          void setFilters({ offset: Math.max(0, offset - limit) });
        });
      }}
      onNext={() => {
        startTransition(() => {
          void setFilters({ offset: offset + limit });
        });
      }}
    />
  );
}

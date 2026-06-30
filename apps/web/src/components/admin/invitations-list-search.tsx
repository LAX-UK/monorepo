"use client";

import { AdminListNuqsSearch } from "@/components/admin/admin-list-nuqs-search";
import { useInvitationsListNuqs } from "@/lib/admin/invitations-list-nuqs";
import { useTransition } from "react";

type Props = {
  placeholder?: string;
  className?: string;
  inputId?: string;
};

/** URL-driven invitations search via nuqs (`q` param, resets offset). */
export function InvitationsListSearch({
  placeholder = "Search by email",
  className,
  inputId = "invitations-list-search",
}: Props) {
  const [filters, setFilters] = useInvitationsListNuqs();
  const [pending, startTransition] = useTransition();

  return (
    <AdminListNuqsSearch
      value={filters.q}
      placeholder={placeholder}
      inputId={inputId}
      pending={pending}
      onSearch={(q) => {
        startTransition(() => {
          void setFilters({ q: q || null, offset: 0 });
        });
      }}
      {...(className ? { className } : {})}
    />
  );
}

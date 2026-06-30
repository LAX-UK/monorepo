"use client";

import { AdminListNuqsSearch } from "@/components/admin/admin-list-nuqs-search";
import { useDisputesListNuqs } from "@/lib/admin/disputes-list-nuqs";
import { useTransition } from "react";

type Props = {
  placeholder?: string;
  className?: string;
  inputId?: string;
};

/** URL-driven disputes search via nuqs (`q` param, resets offset). Reserved for future API support. */
export function DisputesListSearch({
  placeholder = "Search disputes",
  className,
  inputId = "disputes-list-search",
}: Props) {
  const [filters, setFilters] = useDisputesListNuqs();
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

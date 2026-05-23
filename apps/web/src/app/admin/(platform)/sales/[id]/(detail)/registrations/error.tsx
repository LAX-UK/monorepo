"use client";

import { CatalogDetailErrorShell } from "@/components/admin/catalog/catalog-detail-error-shell";
import { useEffect } from "react";

export default function AdminSaleRegistrationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <CatalogDetailErrorShell
      title="Registrations"
      listLabel="Sales"
      listHref="/admin/sales"
      breadcrumbs={[{ label: "Sales", href: "/admin/sales" }, { label: "Registrations" }]}
      reset={reset}
      {...(error.message ? { message: error.message } : {})}
    />
  );
}

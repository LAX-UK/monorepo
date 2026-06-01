"use client";

import { createCatalogDetailRouteError } from "@/components/admin/catalog/create-catalog-detail-route-error";

export default createCatalogDetailRouteError({
  title: "Sale",
  listLabel: "Sales",
  listHref: "/admin/sales",
  breadcrumbs: [{ label: "Sales", href: "/admin/sales" }],
});

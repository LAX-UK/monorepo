"use client";

import { createCatalogDetailRouteError } from "@/components/admin/catalog/create-catalog-detail-route-error";

export default createCatalogDetailRouteError({
  title: "Lot",
  listLabel: "Lots",
  listHref: "/admin/lots",
  breadcrumbs: [{ label: "Lots", href: "/admin/lots" }],
});

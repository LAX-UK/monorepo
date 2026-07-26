"use client";

import { createCatalogDetailRouteError } from "@/components/admin/catalog/create-catalog-detail-route-error";

export default createCatalogDetailRouteError({
  title: "Edit category",
  listLabel: "Categories",
  listHref: "/admin/categories",
  breadcrumbs: [{ label: "Categories", href: "/admin/categories" }],
});

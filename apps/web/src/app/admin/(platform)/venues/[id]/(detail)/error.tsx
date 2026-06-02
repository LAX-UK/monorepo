"use client";

import { createCatalogDetailRouteError } from "@/components/admin/catalog/create-catalog-detail-route-error";

export default createCatalogDetailRouteError({
  title: "Venue",
  listLabel: "Venues",
  listHref: "/admin/venues",
  breadcrumbs: [{ label: "Venues", href: "/admin/venues" }],
});

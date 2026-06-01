"use client";

import { createCatalogDetailRouteError } from "@/components/admin/catalog/create-catalog-detail-route-error";

export default createCatalogDetailRouteError({
  title: "Artist",
  listLabel: "Artists",
  listHref: "/admin/artists",
  breadcrumbs: [{ label: "Artists", href: "/admin/artists" }],
});

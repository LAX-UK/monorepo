"use client";

import { createCatalogListRouteError } from "@/components/admin/catalog/create-catalog-list-route-error";

export default createCatalogListRouteError({
  title: "Payment disputes",
  listHref: "/admin/disputes",
  listLabel: "Back to disputes",
});

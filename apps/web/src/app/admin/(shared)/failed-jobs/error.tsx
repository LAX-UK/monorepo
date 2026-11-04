"use client";

import { createCatalogListRouteError } from "@/components/admin/catalog/create-catalog-list-route-error";

export default createCatalogListRouteError({
  title: "Failed jobs",
  listHref: "/admin/failed-jobs",
  listLabel: "Back to failed jobs",
});

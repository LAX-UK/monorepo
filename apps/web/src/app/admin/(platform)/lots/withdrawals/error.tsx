"use client";

import { createCatalogListRouteError } from "@/components/admin/catalog/create-catalog-list-route-error";

export default createCatalogListRouteError({
  title: "Lot withdrawals",
  listLabel: "Lots",
  listHref: "/admin/lots?lens=attention",
});

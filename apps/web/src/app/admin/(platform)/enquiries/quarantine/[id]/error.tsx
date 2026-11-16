"use client";

import { createCatalogListRouteError } from "@/components/admin/catalog/create-catalog-list-route-error";

export default createCatalogListRouteError({
  title: "Held email",
  listHref: "/admin/enquiries/quarantine",
  listLabel: "Back to held email",
});

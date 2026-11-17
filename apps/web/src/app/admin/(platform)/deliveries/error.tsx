"use client";

import { createCatalogListRouteError } from "@/components/admin/catalog/create-catalog-list-route-error";
import { DELIVERIES_COPY } from "@/lib/admin/deliveries/deliveries-copy";
import { DELIVERIES_PATH } from "@/lib/admin/deliveries/deliveries.vm";

export default createCatalogListRouteError({
  title: DELIVERIES_COPY.title,
  listHref: DELIVERIES_PATH,
  listLabel: DELIVERIES_COPY.error.back,
});

"use client";

import { createCatalogDetailRouteError } from "@/components/admin/catalog/create-catalog-detail-route-error";

export default createCatalogDetailRouteError({
  title: "Submission",
  listLabel: "Submissions",
  listHref: "/admin/submissions",
  breadcrumbs: [{ label: "Submissions", href: "/admin/submissions" }],
});

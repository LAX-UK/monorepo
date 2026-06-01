"use client";

import { createAdminDetailRouteError } from "@/components/admin/create-admin-detail-route-error";

export default createAdminDetailRouteError({
  title: "Client profile",
  backHref: "/admin/clients",
  backLabel: "Back to clients",
});

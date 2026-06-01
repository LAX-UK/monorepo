"use client";

import { createAdminSegmentRouteError } from "@/components/admin/create-admin-segment-route-error";

export default createAdminSegmentRouteError({
  title: "Impersonation error",
  homeHref: "/admin",
  homeLabel: "Back to admin home",
});

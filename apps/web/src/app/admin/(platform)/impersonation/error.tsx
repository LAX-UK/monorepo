"use client";

import { createAdminSegmentRouteError } from "@/components/admin/create-admin-segment-route-error";

export default createAdminSegmentRouteError({
  title: "Support session could not load",
  homeHref: "/admin",
  homeLabel: "Back to Overview",
});

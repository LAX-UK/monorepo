"use client";

import { createFinanceListRouteError } from "@/components/admin/finance/create-finance-list-route-error";

export default createFinanceListRouteError({
  title: "Payment disputes",
  backHref: "/admin/disputes",
  backLabel: "Back to disputes",
});

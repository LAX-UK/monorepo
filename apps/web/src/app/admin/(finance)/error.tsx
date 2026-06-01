"use client";

import { createFinanceListRouteError } from "@/components/admin/finance/create-finance-list-route-error";

export default createFinanceListRouteError({
  title: "Finance",
  backHref: "/admin/finance",
  backLabel: "Back to finance",
});

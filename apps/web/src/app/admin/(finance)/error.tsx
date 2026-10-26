"use client";

import { createFinanceRouteError } from "@/components/admin/finance/create-finance-route-error";

export default createFinanceRouteError({
  title: "Finance",
  backHref: "/admin/finance",
  backLabel: "Back to finance",
});

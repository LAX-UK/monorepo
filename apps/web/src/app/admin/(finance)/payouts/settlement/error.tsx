"use client";

import { createFinanceRouteError } from "@/components/admin/finance/create-finance-route-error";

export default createFinanceRouteError({
  title: "Settlement run",
  backHref: "/admin/payouts",
  backLabel: "Back to payouts",
});

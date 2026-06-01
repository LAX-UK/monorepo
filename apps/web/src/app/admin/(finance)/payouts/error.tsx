"use client";

import { createFinanceListRouteError } from "@/components/admin/finance/create-finance-list-route-error";

export default createFinanceListRouteError({
  title: "Payouts",
  backHref: "/admin/payouts",
  backLabel: "Back to payouts",
});

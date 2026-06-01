"use client";

import { createFinanceListRouteError } from "@/components/admin/finance/create-finance-list-route-error";

export default createFinanceListRouteError({
  title: "Payments",
  backHref: "/admin/payments",
  backLabel: "Back to payments",
});

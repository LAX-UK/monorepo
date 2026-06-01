"use client";

import { createFinancePanelRouteError } from "@/components/admin/finance/create-finance-panel-route-error";

export default createFinancePanelRouteError({
  title: "Run settlement",
  backHref: "/admin/payouts",
  backLabel: "Back to payouts",
});

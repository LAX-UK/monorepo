"use client";

import { createFinancePanelRouteError } from "@/components/admin/finance/create-finance-panel-route-error";

export default createFinancePanelRouteError({
  title: "Xero integration",
  backHref: "/admin/finance",
  backLabel: "Back to finance",
});

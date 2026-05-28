"use client";

import DashboardRouteError from "@/components/dashboard/dashboard-route-error";

export default function CheckoutLotError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardRouteError error={error} reset={reset} title="Checkout unavailable" />;
}

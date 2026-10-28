"use client";

import { AccountRouteError } from "@/components/dashboard/primitives/account-route-error";
import { ACCOUNT_LOAD_ERROR } from "@/lib/dashboard/dashboard-copy";

export default function ConsignmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AccountRouteError error={error} reset={reset} {...ACCOUNT_LOAD_ERROR.consignment} />;
}

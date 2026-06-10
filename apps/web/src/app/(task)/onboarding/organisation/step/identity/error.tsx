"use client";

import DashboardRouteError from "@/components/dashboard/dashboard-route-error";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function OrgOnboardingIdentityError({ error, reset }: Props) {
  return (
    <DashboardRouteError
      error={error}
      reset={reset}
      title="Could not load identity verification step"
    />
  );
}

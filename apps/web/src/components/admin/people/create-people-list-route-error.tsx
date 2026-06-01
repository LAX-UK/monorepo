"use client";

import { PeopleListErrorShell } from "@/components/admin/people/people-list-error-shell";
import { adminRouteErrorMessage } from "@/lib/admin/admin-route-error-message";
import { useEffect } from "react";

type PeopleListRouteErrorConfig = {
  title: string;
  backHref: string;
  backLabel: string;
};

/** Factory for people-module list route error boundaries. */
export function createPeopleListRouteError(config: PeopleListRouteErrorConfig) {
  return function PeopleListRouteError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useEffect(() => {
      console.error(error);
    }, [error]);

    return (
      <PeopleListErrorShell
        title={config.title}
        backHref={config.backHref}
        backLabel={config.backLabel}
        reset={reset}
        message={adminRouteErrorMessage(error)}
      />
    );
  };
}

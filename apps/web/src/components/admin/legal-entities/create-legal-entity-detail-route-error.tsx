"use client";

import { LegalEntityDetailErrorShell } from "@/components/admin/legal-entities/legal-entity-detail-error-shell";
import { useEffect } from "react";

/** Factory for legal entity detail route error boundaries. */
export function createLegalEntityDetailRouteError() {
  return function LegalEntityDetailRouteError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useEffect(() => {
      console.error(error);
    }, [error]);

    return <LegalEntityDetailErrorShell error={error} reset={reset} />;
  };
}

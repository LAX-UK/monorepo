"use client";

import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { useSearchParams } from "next/navigation";

function decodeParam(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function LegalEntityDetailAlerts() {
  const searchParams = useSearchParams();
  const success = decodeParam(searchParams.get("success"));
  const error = decodeParam(searchParams.get("error"));

  if (!success && !error) return null;

  return (
    <>
      {success ? (
        <AdminListAlert title="Done" variant="default">
          {success}
        </AdminListAlert>
      ) : null}
      {error ? <AdminListAlert title="Could not apply change">{error}</AdminListAlert> : null}
    </>
  );
}

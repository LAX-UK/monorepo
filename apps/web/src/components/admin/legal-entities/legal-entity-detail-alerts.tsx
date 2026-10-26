"use client";

import { Notice } from "@auction/staff-ui";
import { useSearchParams } from "next/navigation";

function decodeParam(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** What an action that redirected back here reports, from the page's `?success=` and `?error=`. */
export function LegalEntityDetailAlerts() {
  const searchParams = useSearchParams();
  const success = decodeParam(searchParams.get("success"));
  const error = decodeParam(searchParams.get("error"));

  if (!success && !error) return null;

  return (
    <>
      {success ? <Notice tone="success" title={success} /> : null}
      {error ? (
        <Notice tone="danger" alert title="That change was not applied">
          {error}
        </Notice>
      ) : null}
    </>
  );
}

"use client";

import { ADMIN_NOTICE_PARAM, resolveAdminNotice } from "@/lib/admin/admin-notice";
import { Notice } from "@auction/staff-ui";
import { useSearchParams } from "next/navigation";

/**
 * What an action that redirected back here reports, from the page's `?notice=` code. The copy is
 * fixed in the notice table, so nothing in the URL is shown as text.
 */
export function LegalEntityDetailAlerts() {
  const searchParams = useSearchParams();
  const { success, error } = resolveAdminNotice(searchParams.get(ADMIN_NOTICE_PARAM));

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

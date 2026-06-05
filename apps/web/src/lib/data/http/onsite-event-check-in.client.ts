import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { OnsiteEventCheckInResult, OnsiteEventCheckInSearchRow } from "@auction/types";

export async function fetchOnsiteEventCheckInStats(slug: string): Promise<{
  total: number;
  checkedIn: number;
  checkInDryRun: boolean;
}> {
  const res = await browserFetch(
    `${browserApiBase()}/admin/onsite-events/${encodeURIComponent(slug)}/check-in/stats`,
  );
  if (!res.ok) throw new Error(`Failed to load check-in stats (${res.status})`);
  const body = (await res.json()) as {
    data?: { total: number; checkedIn: number; checkInDryRun?: boolean };
  };
  return {
    total: body.data?.total ?? 0,
    checkedIn: body.data?.checkedIn ?? 0,
    checkInDryRun: body.data?.checkInDryRun ?? false,
  };
}

export async function setOnsiteEventCheckInDryRun(
  slug: string,
  enabled: boolean,
): Promise<boolean> {
  const res = await browserFetch(
    `${browserApiBase()}/admin/onsite-events/${encodeURIComponent(slug)}/check-in/dry-run`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    },
  );
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Dry-run update failed (${res.status})`);
  }
  const body = (await res.json()) as { data?: { checkInDryRun?: boolean } };
  return body.data?.checkInDryRun ?? enabled;
}

export async function resendOnsiteEventPass(slug: string, rsvpId: string): Promise<boolean> {
  const res = await browserFetch(
    `${browserApiBase()}/admin/onsite-events/${encodeURIComponent(slug)}/rsvps/${encodeURIComponent(rsvpId)}/resend-pass`,
    { method: "POST" },
  );
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Resend failed (${res.status})`);
  }
  const body = (await res.json()) as { data?: { rotated?: boolean } };
  return body.data?.rotated ?? false;
}

export async function searchOnsiteEventGuests(
  slug: string,
  query: string,
): Promise<OnsiteEventCheckInSearchRow[]> {
  const params = new URLSearchParams({ q: query });
  const res = await browserFetch(
    `${browserApiBase()}/admin/onsite-events/${encodeURIComponent(slug)}/check-in/search?${params}`,
  );
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const body = (await res.json()) as { data?: OnsiteEventCheckInSearchRow[] };
  return body.data ?? [];
}

export async function checkInOnsiteEventGuest(
  slug: string,
  input: { token?: string; rsvpId?: string },
): Promise<OnsiteEventCheckInResult> {
  const res = await browserFetch(
    `${browserApiBase()}/admin/onsite-events/${encodeURIComponent(slug)}/check-in`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Check-in failed (${res.status})`);
  }
  const body = (await res.json()) as { data?: OnsiteEventCheckInResult };
  if (!body.data) throw new Error("Check-in returned no result");
  return body.data;
}

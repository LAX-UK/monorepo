/** Dev-only probe for the self-hosted GTM endpoint (analytics debug panel). */
export async function pingGtmHealth(): Promise<string> {
  try {
    const res = await fetch("https://gtm.lax.bid/healthy");
    return `gtm.lax.bid/healthy → ${res.status}`;
  } catch (e: unknown) {
    return `gtm.lax.bid fetch failed: ${String(e)}`;
  }
}

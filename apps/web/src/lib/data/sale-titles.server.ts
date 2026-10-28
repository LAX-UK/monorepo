import "server-only";
import { getServerSaleShell } from "@/lib/data/http/sales.server";

/**
 * Sale titles for a batch of sale ids, so account pages can say which sale a lot is in. Missing
 * or failed lookups are left out and the card simply shows no sale line. Each sale is read once
 * per request (the reader is cached).
 */
export async function resolveSaleTitles(
  saleIds: readonly (string | null | undefined)[],
): Promise<Record<string, string>> {
  const unique = [...new Set(saleIds.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return {};
  const entries = await Promise.allSettled(
    unique.map(async (id) => {
      const shell = await getServerSaleShell(id);
      return shell ? ([id, shell.sale.title] as const) : null;
    }),
  );
  const titles: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.status === "fulfilled" && entry.value) titles[entry.value[0]] = entry.value[1];
  }
  return titles;
}

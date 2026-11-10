import "server-only";
import { getServerSaleShell } from "@/lib/data/http/sales.server";

type SaleShell = NonNullable<Awaited<ReturnType<typeof getServerSaleShell>>>;

/**
 * One field of each sale in a batch, keyed by sale id. Missing or failed lookups are left out, so
 * a card simply shows no sale line. Each sale is read once per request (the reader is cached).
 */
async function resolveSaleField(
  saleIds: readonly (string | null | undefined)[],
  pick: (shell: SaleShell) => string,
): Promise<Record<string, string>> {
  const unique = [...new Set(saleIds.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return {};
  const entries = await Promise.allSettled(
    unique.map(async (id) => {
      const shell = await getServerSaleShell(id);
      return shell ? ([id, pick(shell)] as const) : null;
    }),
  );
  const values: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.status === "fulfilled" && entry.value) values[entry.value[0]] = entry.value[1];
  }
  return values;
}

/** Sale titles for a batch of sale ids, so account pages can say which sale a lot is in. */
export function resolveSaleTitles(
  saleIds: readonly (string | null | undefined)[],
): Promise<Record<string, string>> {
  return resolveSaleField(saleIds, (shell) => shell.sale.title);
}

/** The zone each sale quotes its times in, so account pages can add the visitor's own time. */
export function resolveSaleZones(
  saleIds: readonly (string | null | undefined)[],
): Promise<Record<string, string>> {
  return resolveSaleField(saleIds, (shell) => shell.sale.timeZone);
}

import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";

/** Fill missing `legalEntityDisplayName` when the venues list API omits the join. */
export async function enrichVenueListWithLegalEntityNames(
  rows: AdminVenueListRow[],
): Promise<AdminVenueListRow[]> {
  const idsToResolve = [
    ...new Set(
      rows.filter((row) => !row.legalEntityDisplayName?.trim()).map((row) => row.legalEntityId),
    ),
  ];
  if (idsToResolve.length === 0) return rows;

  const names = await Promise.all(
    idsToResolve.map(async (id) => {
      const entity = await getAdminLegalEntityById(id).catch(() => null);
      return [id, entity?.displayName?.trim() || null] as const;
    }),
  );
  const nameById = new Map(names);

  return rows.map((row) => ({
    ...row,
    legalEntityDisplayName:
      row.legalEntityDisplayName?.trim() || nameById.get(row.legalEntityId) || null,
  }));
}

import {
  organisationRoleLabel,
  organisationRoleRank,
} from "@/lib/presenters/organisation-role/organisation-role-presentation";
import type { LegalEntityMemberRole } from "@auction/types";

export type MemberRoleFilter = "all" | LegalEntityMemberRole;

type Filterable = { name: string; email: string; role: LegalEntityMemberRole };

/** People whose name or email holds the words, in the chosen role. */
export function filterMemberRows<T extends Filterable>(
  rows: readonly T[],
  { query, role }: { query: string; role: MemberRoleFilter },
): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (role !== "all" && row.role !== role) return false;
    const haystack = `${row.name} ${row.email}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** "All roles", then each role someone in the team holds, owners first. */
export function memberRoleFilterOptions(
  rows: readonly Filterable[],
): { value: MemberRoleFilter; label: string }[] {
  const held = [...new Set(rows.map((row) => row.role))].sort(
    (a, b) => organisationRoleRank(a) - organisationRoleRank(b),
  );
  return [
    { value: "all", label: "All roles" },
    ...held.map((role) => ({ value: role, label: organisationRoleLabel(role) })),
  ];
}

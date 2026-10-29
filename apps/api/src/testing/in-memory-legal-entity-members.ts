import type {
  ILegalEntityMemberRepository,
  LegalEntityMemberRow,
} from "@auction/persistence/interfaces";
import { rowToLegalEntityMember } from "@auction/persistence/lib";
import type { LegalEntityMemberRole } from "@auction/types";
import { vi } from "vitest";

export const TEST_ENTITY_ID = "00000000-0000-4000-8000-000000000001";

/** A membership row of the test organisation; its user id is `user-<id>`. */
export function memberRow(
  id: string,
  role: LegalEntityMemberRole,
  overrides: Partial<LegalEntityMemberRow> = {},
): LegalEntityMemberRow {
  return {
    id,
    legalEntityId: TEST_ENTITY_ID,
    userId: `user-${id}`,
    role,
    isPrimaryAdmin: false,
    invitedByUserId: null,
    invitedAt: null,
    acceptedAt: new Date("2026-01-01"),
    removedAt: null,
    welcomeDismissedAt: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** An organisation's team in memory behind the member repository port; names are `Name <id>`. */
export function inMemoryLegalEntityMembers(rows: readonly LegalEntityMemberRow[]) {
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const active = () => [...byId.values()].filter((r) => !r.removedAt);
  const repo = {
    listMembersWithUsers: vi.fn(async (legalEntityId: string) =>
      active()
        .filter((r) => r.legalEntityId === legalEntityId)
        .map((r) => ({
          ...rowToLegalEntityMember(r),
          user: { id: r.userId, email: `${r.id}@example.com`, name: `Name ${r.id}`, image: null },
        })),
    ),
    findMemberById: vi.fn(async (id: string) => byId.get(id) ?? null),
    findActiveMemberConfirmationContext: vi.fn(async (id: string) => {
      const row = byId.get(id);
      return row && !row.removedAt ? { role: row.role, memberName: `Name ${id}` } : null;
    }),
    findActiveMembership: vi.fn(
      async (userId: string, legalEntityId: string) =>
        active().find((r) => r.userId === userId && r.legalEntityId === legalEntityId) ?? null,
    ),
    lockActiveMembers: vi.fn(async (_tx: unknown, legalEntityId: string) =>
      active()
        .filter((r) => r.legalEntityId === legalEntityId)
        .map((r) => ({ ...r })),
    ),
    updateRole: vi.fn(
      async (
        _tx: unknown,
        id: string,
        change: { role: LegalEntityMemberRole; isPrimaryAdmin: boolean },
      ) => {
        const row = byId.get(id);
        if (!row) throw new Error(`no member ${id}`);
        Object.assign(row, change);
        return rowToLegalEntityMember(row);
      },
    ),
    markRemoved: vi.fn(async (_tx: unknown, id: string) => {
      const row = byId.get(id);
      if (row) row.removedAt = new Date();
    }),
  } satisfies ILegalEntityMemberRepository;
  return { repo, byId };
}

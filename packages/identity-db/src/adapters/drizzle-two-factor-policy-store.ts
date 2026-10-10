import { and, countDistinct, eq, inArray, isNull, max, or, sql } from "drizzle-orm";
import { identityAccessMarker, identityMfaPolicy } from "../schema/access-policy.js";
import { session, user } from "../schema/auth.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";

type PolicyScope = { scope: "staff" } | { scope: "org"; legalEntityId: string };

type Marker =
  | { kind: "staff"; product: "bid" | "shop" }
  | { kind: "org_member"; legalEntityId: string };

type PolicyRow = typeof identityMfaPolicy.$inferSelect;

function toPolicyRecord(row: PolicyRow) {
  const base = { required: row.required, setBySubjectId: row.setBySubjectId, setAt: row.setAt };
  return row.scope === "org" && row.legalEntityId
    ? { scope: "org" as const, legalEntityId: row.legalEntityId, ...base }
    : { scope: "staff" as const, ...base };
}

function policyWhere(scope: PolicyScope) {
  return scope.scope === "staff"
    ? and(eq(identityMfaPolicy.scope, "staff"), isNull(identityMfaPolicy.legalEntityId))
    : and(
        eq(identityMfaPolicy.scope, "org"),
        eq(identityMfaPolicy.legalEntityId, scope.legalEntityId),
      );
}

function markerWhere(scope: PolicyScope) {
  return scope.scope === "staff"
    ? eq(identityAccessMarker.kind, "staff")
    : and(
        eq(identityAccessMarker.kind, "org_member"),
        eq(identityAccessMarker.legalEntityId, scope.legalEntityId),
      );
}

export function createDrizzleTwoFactorPolicyStore(db: IdentityDatabase) {
  return {
    async readSubjectPolicyInputs(subjectId: string) {
      const markerRows = await db
        .select({
          kind: identityAccessMarker.kind,
          product: identityAccessMarker.product,
          legalEntityId: identityAccessMarker.legalEntityId,
        })
        .from(identityAccessMarker)
        .where(eq(identityAccessMarker.subjectId, subjectId));
      const markers = markerRows.flatMap((row): Marker[] => {
        if (row.kind === "staff" && (row.product === "bid" || row.product === "shop")) {
          return [{ kind: "staff", product: row.product }];
        }
        if (row.kind === "org_member" && row.legalEntityId) {
          return [{ kind: "org_member", legalEntityId: row.legalEntityId }];
        }
        return [];
      });
      if (markers.length === 0) return { markers, policies: [] };

      const orgIds = markers.flatMap((marker) =>
        marker.kind === "org_member" ? [marker.legalEntityId] : [],
      );
      const policyRows = await db
        .select()
        .from(identityMfaPolicy)
        .where(
          or(
            eq(identityMfaPolicy.scope, "staff"),
            orgIds.length > 0
              ? and(
                  eq(identityMfaPolicy.scope, "org"),
                  inArray(identityMfaPolicy.legalEntityId, orgIds),
                )
              : sql`false`,
          ),
        );
      const policies = policyRows.map((row) => {
        const record = toPolicyRecord(row);
        return record.scope === "org"
          ? {
              scope: "org" as const,
              legalEntityId: record.legalEntityId,
              required: record.required,
            }
          : { scope: "staff" as const, required: record.required };
      });
      return { markers, policies };
    },

    async readPolicy(scope: PolicyScope) {
      const [row] = await db.select().from(identityMfaPolicy).where(policyWhere(scope)).limit(1);
      return row ? toPolicyRecord(row) : null;
    },

    async writePolicy(
      scope: PolicyScope,
      input: { required: boolean; setBySubjectId: string; at: Date },
    ) {
      const values = {
        required: input.required,
        setBySubjectId: input.setBySubjectId,
        setAt: input.at,
      };
      const [row] = await db
        .insert(identityMfaPolicy)
        .values({
          scope: scope.scope,
          legalEntityId: scope.scope === "org" ? scope.legalEntityId : null,
          ...values,
        })
        .onConflictDoUpdate(
          scope.scope === "staff"
            ? {
                target: identityMfaPolicy.scope,
                targetWhere: sql`${identityMfaPolicy.scope} = 'staff'`,
                set: values,
              }
            : {
                target: identityMfaPolicy.legalEntityId,
                targetWhere: sql`${identityMfaPolicy.scope} = 'org'`,
                set: values,
              },
        )
        .returning();
      if (!row) throw new Error("Two-step verification policy upsert returned no row");
      return toPolicyRecord(row);
    },

    async countCoverage(scope: PolicyScope) {
      const [row] = await db
        .select({
          members: countDistinct(identityAccessMarker.subjectId),
          enrolled: sql<number>`count(distinct ${identityAccessMarker.subjectId}) filter (where ${user.twoFactorEnabled} is true)`,
        })
        .from(identityAccessMarker)
        .innerJoin(user, eq(user.id, identityAccessMarker.subjectId))
        .where(markerWhere(scope));
      return { members: Number(row?.members ?? 0), enrolled: Number(row?.enrolled ?? 0) };
    },

    async readTwoFactorEnabled(subjectIds: readonly string[]) {
      if (subjectIds.length === 0) return new Map<string, boolean>();
      const rows = await db
        .select({ id: user.id, twoFactorEnabled: user.twoFactorEnabled })
        .from(user)
        .where(inArray(user.id, [...subjectIds]));
      return new Map(rows.map((row) => [row.id, row.twoFactorEnabled === true]));
    },

    async readLastSignIn(subjectIds: readonly string[]) {
      if (subjectIds.length === 0) return new Map<string, Date>();
      const rows = await db
        .select({ userId: session.userId, at: max(session.createdAt) })
        .from(session)
        .where(inArray(session.userId, [...subjectIds]))
        .groupBy(session.userId);
      return new Map(rows.flatMap((row) => (row.at ? [[row.userId, row.at] as const] : [])));
    },
  };
}

import { randomUUID } from "node:crypto";
import {
  type AgreementTerms,
  type ConsignmentPlace,
  type Consignor,
  type ConsignorAgreement,
  type ConsignorCover,
  type ConsignorLink,
  assessConsignorCover,
  nextConsignorSetTime,
  orderPlaces,
  planAgreementChange,
  planConsignorChange,
} from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import {
  consignorAgreement as agreement,
  artworkConsignorLink as link,
  shopParty as party,
  artworkRegister as register,
} from "@auction/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  AddAgreementInput,
  AddAgreementResult,
  AgreementChangeResult,
  IConsignorAgreementStore,
  ReplaceAgreementInput,
  RetireAgreementInput,
  SetConsignorInput,
  SetConsignorResult,
} from "../../interfaces/consignor-agreement.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type AgreementRow = typeof agreement.$inferSelect;
type LinkRow = typeof link.$inferSelect;

function toAgreement(row: AgreementRow): ConsignorAgreement {
  const places: ConsignmentPlace[] = [];
  if (row.coversLaxBid) places.push("lax_bid");
  if (row.coversLaxArt) places.push("lax_art");
  if (row.coversPrivateSale) places.push("private_sale");
  return {
    id: row.id,
    agreementId: row.agreementId,
    version: row.version,
    partyId: row.partyId,
    places,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    lowestPricePence: row.lowestPricePence,
    commissionBasisPoints: row.commissionBasisPoints,
    signedFileKey: row.signedFileKey,
    note: row.note,
    status: row.status,
    replacesId: row.replacesId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    replacedAt: row.replacedAt,
    retiredAt: row.retiredAt,
    retiredBy: row.retiredBy,
  };
}

function toLink(row: LinkRow): ConsignorLink {
  return {
    id: row.id,
    registerId: row.registerId,
    consignor:
      row.consignor === "client" && row.partyId
        ? { kind: "client", partyId: row.partyId }
        : { kind: "lax" },
    changeReason: row.changeReason,
    setBy: row.setBy,
    setAt: row.setAt,
  };
}

/** The term columns of a new version. */
function termColumns(terms: AgreementTerms) {
  const places = orderPlaces(terms.places);
  return {
    coversLaxBid: places.includes("lax_bid"),
    coversLaxArt: places.includes("lax_art"),
    coversPrivateSale: places.includes("private_sale"),
    startsOn: terms.startsOn,
    endsOn: terms.endsOn,
    lowestPricePence: terms.lowestPricePence,
    commissionBasisPoints: terms.commissionBasisPoints,
    signedFileKey: terms.signedFileKey,
    note: terms.note,
  };
}

/** Current versions first, then retired, then replaced; newest first within each. */
const STATUS_ORDER = sql`CASE ${agreement.status} WHEN 'current' THEN 0 WHEN 'retired' THEN 1 ELSE 2 END`;

export class DrizzleConsignorAgreementStore implements IConsignorAgreementStore {
  constructor(private readonly db: Database) {}

  async listAgreements(
    partyId: string,
    options?: { includeReplaced?: boolean },
  ): Promise<ConsignorAgreement[]> {
    const rows = await this.db
      .select()
      .from(agreement)
      .where(
        and(
          eq(agreement.partyId, partyId),
          options?.includeReplaced ? undefined : sql`${agreement.status} <> 'replaced'`,
        ),
      )
      .orderBy(STATUS_ORDER, desc(agreement.createdAt), desc(agreement.id));
    return rows.map(toAgreement);
  }

  async findAgreementVersion(id: string): Promise<ConsignorAgreement | null> {
    const [row] = await this.db.select().from(agreement).where(eq(agreement.id, id)).limit(1);
    return row ? toAgreement(row) : null;
  }

  async listVersions(agreementId: string): Promise<ConsignorAgreement[]> {
    const rows = await this.db
      .select()
      .from(agreement)
      .where(eq(agreement.agreementId, agreementId))
      .orderBy(asc(agreement.version));
    return rows.map(toAgreement);
  }

  async currentConsignors(registerIds: readonly string[]): Promise<Map<string, ConsignorLink>> {
    const ids = [...new Set(registerIds)];
    if (ids.length === 0) return new Map();
    const rows = await this.latestLinks(this.db, ids);
    return new Map(rows.map((row) => [row.registerId, toLink(row)]));
  }

  async listConsignorChanges(registerId: string, limit: number): Promise<ConsignorLink[]> {
    const rows = await this.db
      .select()
      .from(link)
      .where(eq(link.registerId, registerId))
      .orderBy(desc(link.setAt))
      .limit(limit);
    return rows.map(toLink);
  }

  async assessCover(input: {
    registerId: string;
    place: ConsignmentPlace;
    day: string;
  }): Promise<ConsignorCover> {
    const current = (await this.currentConsignors([input.registerId])).get(input.registerId);
    const consignor = current?.consignor ?? null;
    const agreements =
      consignor?.kind === "client"
        ? (
            await this.db
              .select()
              .from(agreement)
              .where(and(eq(agreement.partyId, consignor.partyId), eq(agreement.status, "current")))
          ).map(toAgreement)
        : [];
    return assessConsignorCover({ consignor, agreements, place: input.place, day: input.day });
  }

  async addAgreement(input: AddAgreementInput): Promise<AddAgreementResult> {
    return this.db.transaction(async (tx) => {
      // A key share lock keeps the client from being deleted until this commits.
      if (!(await this.lockClient(tx, input.partyId))) {
        return { ok: false, reason: "party_not_found" } as const;
      }
      // The first version's id is the agreement's id, shared by every later version.
      const id = randomUUID();
      const [row] = await tx
        .insert(agreement)
        .values({
          id,
          agreementId: id,
          version: 1,
          partyId: input.partyId,
          replacesId: null,
          ...termColumns(input.terms),
          createdBy: input.actor,
          createdAt: input.now,
        })
        .returning();
      if (!row) throw new Error("consignor_agreement insert returned no row");
      return { ok: true, agreement: toAgreement(row) } as const;
    });
  }

  async replaceAgreement(input: ReplaceAgreementInput): Promise<AgreementChangeResult> {
    return this.db.transaction(async (tx) => {
      const current = await this.lockLatestVersion(tx, input.agreementId);
      if (!current) return NOT_FOUND;
      const plan = planAgreementChange({ current, expectedVersion: input.expectedVersion });
      if (!plan.ok) return plan;
      // The old version is marked replaced before the new one is added, so the agreement never
      // has two current versions, even for a moment inside this transaction.
      await tx
        .update(agreement)
        .set({ status: "replaced", replacedAt: input.now })
        .where(eq(agreement.id, current.id));
      const [row] = await tx
        .insert(agreement)
        .values({
          id: randomUUID(),
          agreementId: current.agreementId,
          version: plan.nextVersion,
          partyId: current.partyId,
          replacesId: current.id,
          ...termColumns(input.terms),
          createdBy: input.actor,
          createdAt: input.now,
        })
        .returning();
      if (!row) throw new Error("consignor_agreement insert returned no row");
      return { ok: true, agreement: toAgreement(row) } as const;
    });
  }

  async retireAgreement(input: RetireAgreementInput): Promise<AgreementChangeResult> {
    return this.db.transaction(async (tx) => {
      const current = await this.lockLatestVersion(tx, input.agreementId);
      if (!current) return NOT_FOUND;
      const plan = planAgreementChange({ current, expectedVersion: input.expectedVersion });
      if (!plan.ok) return plan;
      const [row] = await tx
        .update(agreement)
        .set({ status: "retired", retiredAt: input.now, retiredBy: input.actor })
        .where(eq(agreement.id, current.id))
        .returning();
      if (!row) throw new Error("consignor_agreement update returned no row");
      return { ok: true, agreement: toAgreement(row) } as const;
    });
  }

  async setConsignor(input: SetConsignorInput): Promise<SetConsignorResult> {
    return this.db.transaction(async (tx) => {
      // Two people setting the same artwork's consignor take turns: each reads the other's change.
      const [artwork] = await tx
        .select({ id: register.id })
        .from(register)
        .where(eq(register.id, input.registerId))
        .for("no key update");
      if (!artwork) return { ok: false, reason: "artwork_not_found" } as const;

      const [latest] = await this.latestLinks(tx, [input.registerId]);
      const current = latest ? toLink(latest) : null;
      const plan = planConsignorChange({
        current: current?.consignor ?? null,
        next: input.consignor,
        reason: input.reason,
      });
      if (!plan.ok) return plan;
      if (!plan.changes && current) return { ok: true, changed: false, link: current } as const;

      if (
        input.consignor.kind === "client" &&
        !(await this.lockClient(tx, input.consignor.partyId))
      )
        return { ok: false, reason: "party_not_found" } as const;

      const [row] = await tx
        .insert(link)
        .values({
          registerId: input.registerId,
          ...consignorColumns(input.consignor),
          changeReason: plan.changes ? plan.reason : null,
          setBy: input.actor,
          setAt: nextConsignorSetTime(input.now, current?.setAt ?? null),
        })
        .returning();
      if (!row) throw new Error("artwork_consignor_link insert returned no row");
      return { ok: true, changed: true, link: toLink(row) } as const;
    });
  }

  /**
   * The newest version of an agreement, locked until the transaction ends, so a replace and a
   * retire of the same agreement take turns and the second reads the first's result.
   */
  private async lockLatestVersion(tx: Tx, agreementId: string): Promise<AgreementRow | null> {
    const [row] = await tx
      .select()
      .from(agreement)
      .where(eq(agreement.agreementId, agreementId))
      .orderBy(desc(agreement.version))
      .limit(1)
      .for("update");
    return row ?? null;
  }

  /** True when the party is a client (not LAX itself), share-locked so it stays until commit. */
  private async lockClient(tx: Tx, partyId: string): Promise<boolean> {
    const [row] = await tx
      .select({ kind: party.kind })
      .from(party)
      .where(eq(party.id, partyId))
      .for("key share");
    return row !== undefined && row.kind !== "lax";
  }

  private async latestLinks(db: Database | Tx, registerIds: readonly string[]) {
    return db
      .selectDistinctOn([link.registerId])
      .from(link)
      .where(inArray(link.registerId, [...registerIds]))
      .orderBy(link.registerId, desc(link.setAt));
  }
}

const NOT_FOUND: AgreementChangeResult = { ok: false, reason: "not_found" };

function consignorColumns(consignor: Consignor) {
  return consignor.kind === "client"
    ? { consignor: "client" as const, partyId: consignor.partyId }
    : { consignor: "lax" as const, partyId: null };
}

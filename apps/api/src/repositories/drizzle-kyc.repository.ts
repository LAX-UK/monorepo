import type { Database } from "@auction/db";
import {
  bid,
  itemSubmission,
  kycVerification,
  legalEntity,
  lot,
  payment,
  user,
} from "@auction/db/schema";
import type { KycVerification } from "@auction/types";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  CreateKycVerificationInput,
  IKycRepository,
  UpdateKycVerificationPatch,
} from "../services/interfaces/kyc-repository.js";

function rowToKyc(row: typeof kycVerification.$inferSelect): KycVerification {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    providerSessionId: row.providerSessionId,
    providerAttemptId: row.providerAttemptId ?? null,
    status: row.status,
    verifiedFirstName: row.verifiedFirstName ?? null,
    verifiedLastName: row.verifiedLastName ?? null,
    verifiedDateOfBirth: row.verifiedDateOfBirth ? new Date(row.verifiedDateOfBirth) : null,
    verifiedIdNumberLast4: row.verifiedIdNumberLast4 ?? null,
    verifiedIdCountry: row.verifiedIdCountry ?? null,
    verifiedIdType: row.verifiedIdType ?? null,
    verifiedIdExpiry: row.verifiedIdExpiry ? new Date(row.verifiedIdExpiry) : null,
    createdAt: row.createdAt,
    decisionAt: row.decisionAt ?? null,
  };
}

export class DrizzleKycRepository implements IKycRepository {
  constructor(private readonly db: Database) {}

  private resolveConn(conn?: Database): Database {
    return conn ?? this.db;
  }

  async create(input: CreateKycVerificationInput): Promise<KycVerification> {
    const [row] = await this.db
      .insert(kycVerification)
      .values({
        userId: input.userId,
        provider: input.provider,
        providerSessionId: input.providerSessionId,
        status: input.status,
      })
      .returning();
    if (!row) throw new Error("kyc_create_failed");
    return rowToKyc(row);
  }

  async createWithCurrentSession(input: CreateKycVerificationInput): Promise<KycVerification> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(kycVerification)
        .values({
          userId: input.userId,
          provider: input.provider,
          providerSessionId: input.providerSessionId,
          status: input.status,
        })
        .returning();
      if (!row) throw new Error("kyc_create_failed");
      await tx
        .update(user)
        .set({
          currentKycSessionId: input.providerSessionId,
          kycStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(user.id, input.userId));
      return rowToKyc(row);
    });
  }

  async getUserKycWebhookState(
    userId: string,
    conn?: Database,
  ): Promise<{
    currentKycSessionId: string | null;
    kycRetryCount: number;
  } | null> {
    const db = this.resolveConn(conn);
    const rows = await db
      .select({
        currentKycSessionId: user.currentKycSessionId,
        kycRetryCount: user.kycRetryCount,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      currentKycSessionId: row.currentKycSessionId ?? null,
      kycRetryCount: row.kycRetryCount ?? 0,
    };
  }

  async incrementUserKycRetryCount(userId: string, conn?: Database): Promise<void> {
    const db = this.resolveConn(conn);
    await db
      .update(user)
      .set({
        kycRetryCount: sql`${user.kycRetryCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }

  async getUserKycState(
    userId: string,
    conn?: Database,
  ): Promise<{
    kycStatus: "unverified" | "pending" | "approved" | "rejected";
    kycVerifiedAt: Date | null;
  } | null> {
    const db = this.resolveConn(conn);
    const rows = await db
      .select({
        kycStatus: user.kycStatus,
        kycVerifiedAt: user.kycVerifiedAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      kycStatus: row.kycStatus,
      kycVerifiedAt: row.kycVerifiedAt ?? null,
    };
  }

  async findById(id: string, conn?: Database): Promise<KycVerification | null> {
    const db = this.resolveConn(conn);
    const rows = await db.select().from(kycVerification).where(eq(kycVerification.id, id)).limit(1);
    return rows[0] ? rowToKyc(rows[0]) : null;
  }

  async findByProviderSessionId(
    sessionId: string,
    conn?: Database,
  ): Promise<KycVerification | null> {
    const db = this.resolveConn(conn);
    const rows = await db
      .select()
      .from(kycVerification)
      .where(eq(kycVerification.providerSessionId, sessionId))
      .limit(1);
    return rows[0] ? rowToKyc(rows[0]) : null;
  }

  async findLatestByUserId(userId: string, conn?: Database): Promise<KycVerification | null> {
    const db = this.resolveConn(conn);
    const rows = await db
      .select()
      .from(kycVerification)
      .where(eq(kycVerification.userId, userId))
      .orderBy(desc(kycVerification.createdAt))
      .limit(1);
    return rows[0] ? rowToKyc(rows[0]) : null;
  }

  async update(
    id: string,
    patch: UpdateKycVerificationPatch,
    conn?: Database,
  ): Promise<KycVerification> {
    const db = this.resolveConn(conn);
    const values: Record<string, unknown> = {};
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.providerAttemptId !== undefined) values.providerAttemptId = patch.providerAttemptId;
    if (patch.verifiedFirstName !== undefined) values.verifiedFirstName = patch.verifiedFirstName;
    if (patch.verifiedLastName !== undefined) values.verifiedLastName = patch.verifiedLastName;
    if (patch.verifiedDateOfBirth !== undefined) {
      values.verifiedDateOfBirth = patch.verifiedDateOfBirth
        ? patch.verifiedDateOfBirth.toISOString().slice(0, 10)
        : null;
    }
    if (patch.verifiedIdNumberLast4 !== undefined)
      values.verifiedIdNumberLast4 = patch.verifiedIdNumberLast4;
    if (patch.verifiedIdCountry !== undefined) values.verifiedIdCountry = patch.verifiedIdCountry;
    if (patch.verifiedIdType !== undefined) values.verifiedIdType = patch.verifiedIdType;
    if (patch.verifiedIdExpiry !== undefined) {
      values.verifiedIdExpiry = patch.verifiedIdExpiry
        ? patch.verifiedIdExpiry.toISOString().slice(0, 10)
        : null;
    }
    if (patch.decisionPayload !== undefined) values.decisionPayload = patch.decisionPayload;
    if (patch.decisionAt !== undefined) values.decisionAt = patch.decisionAt;

    const [row] = await db
      .update(kycVerification)
      .set(values)
      .where(eq(kycVerification.id, id))
      .returning();
    if (!row) throw new Error("kyc_update_failed");
    return rowToKyc(row);
  }

  async getPendingExposure(userId: string): Promise<{ total: number; currency: string }> {
    const [bidsRow] = await this.db
      .select({
        total: sql<string | null>`coalesce(sum(${bid.amount}), 0)`,
      })
      .from(bid)
      .innerJoin(lot, eq(lot.id, bid.lotId))
      .where(
        and(
          eq(bid.bidderId, userId),
          eq(bid.isWinning, true),
          inArray(lot.status, ["active", "ended"]),
        ),
      );

    const [paymentsRow] = await this.db
      .select({
        total: sql<string | null>`coalesce(sum(${payment.amount}), 0)`,
      })
      .from(payment)
      .where(and(eq(payment.buyerId, userId), inArray(payment.status, ["pending", "authorized"])));

    const [submissionsRow] = await this.db
      .select({
        total: sql<string | null>`coalesce(sum(coalesce(${itemSubmission.askingPrice}, 0)), 0)`,
      })
      .from(itemSubmission)
      .innerJoin(legalEntity, eq(legalEntity.id, itemSubmission.legalEntityId))
      .where(
        and(
          eq(legalEntity.createdByUserId, userId),
          inArray(itemSubmission.status, ["submitted", "under_review"]),
        ),
      );

    const total =
      Number(bidsRow?.total ?? 0) +
      Number(paymentsRow?.total ?? 0) +
      Number(submissionsRow?.total ?? 0);
    return { total, currency: "GBP" }; // Platform is GBP-only; exposure sums are not filtered by currency.
  }

  async setUserKycStatus(
    userId: string,
    status: "unverified" | "pending" | "approved" | "rejected",
    verifiedAt: Date | null,
    conn?: Database,
  ): Promise<void> {
    const db = this.resolveConn(conn);
    await db
      .update(user)
      .set({
        kycStatus: status,
        kycVerifiedAt: verifiedAt,
        ...(status === "approved" ? { kycRetryCount: 0 } : {}),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }
}

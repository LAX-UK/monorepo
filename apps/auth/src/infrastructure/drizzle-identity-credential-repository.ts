import type { IdentityDatabase } from "@auction/identity-db";
import { account } from "@auction/identity-db/schema";
import { and, eq } from "drizzle-orm";
import type {
  IIdentityCredentialRepository,
  IdentityOperationTransaction,
} from "../services/identity-operations.ports.js";
import { identityOperationDb } from "./drizzle-identity-unit-of-work.js";

export class DrizzleIdentityCredentialRepository implements IIdentityCredentialRepository {
  constructor(private readonly db: IdentityDatabase) {}

  async listProviders(
    subjectId: string,
  ): Promise<Array<{ providerId: string; hasPassword: boolean }>> {
    const rows = await this.db
      .select({ providerId: account.providerId, password: account.password })
      .from(account)
      .where(eq(account.userId, subjectId));
    return rows.map((row) => ({
      providerId: row.providerId,
      hasPassword: Boolean(row.password),
    }));
  }

  async findCredential(
    subjectId: string,
  ): Promise<{ id: string; passwordHash: string | null } | null> {
    const [credential] = await this.db
      .select({ id: account.id, passwordHash: account.password })
      .from(account)
      .where(and(eq(account.userId, subjectId), eq(account.providerId, "credential")))
      .limit(1);
    return credential ?? null;
  }

  async insertCredential(
    transaction: IdentityOperationTransaction,
    input: {
      id: string;
      subjectId: string;
      passwordHash: string;
      now: Date;
    },
  ): Promise<"inserted" | "already_set"> {
    const tx = identityOperationDb(this.db, transaction);
    const [existing] = await tx
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, input.subjectId), eq(account.providerId, "credential")))
      .limit(1);
    if (existing) return "already_set";
    await tx.insert(account).values({
      id: input.id,
      accountId: input.subjectId,
      providerId: "credential",
      userId: input.subjectId,
      password: input.passwordHash,
      createdAt: input.now,
      updatedAt: input.now,
    });
    return "inserted";
  }

  async updatePassword(
    transaction: IdentityOperationTransaction,
    input: {
      credentialId: string;
      subjectId: string;
      passwordHash: string;
      now: Date;
    },
  ): Promise<void> {
    const tx = identityOperationDb(this.db, transaction);
    await tx
      .update(account)
      .set({ password: input.passwordHash, updatedAt: input.now })
      .where(and(eq(account.id, input.credentialId), eq(account.userId, input.subjectId)));
  }
}

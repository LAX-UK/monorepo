import { type SocialSignInProvider, openProviderEmail } from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import { account, passkey } from "@auction/identity-db/schema";
import { and, asc, eq } from "drizzle-orm";
import type {
  IIdentityCredentialRepository,
  IdentityOperationTransaction,
} from "../services/identity-operations.ports.js";
import type { PasskeyRow, SignInAccountRow } from "../services/sign-in-method-rules.js";
import { identityOperationDb } from "./drizzle-identity-unit-of-work.js";

const SIGN_IN_ACCOUNT_COLUMNS = {
  providerId: account.providerId,
  password: account.password,
  createdAt: account.createdAt,
  providerEmail: account.providerEmail,
  providerEmailHidden: account.providerEmailHidden,
};

/** Opens sealed values; the address a provider reported is stored sealed like its tokens. */
export type AddressOpener = { open(sealed: string): string };

export class DrizzleIdentityCredentialRepository implements IIdentityCredentialRepository {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly crypto: AddressOpener | null = null,
  ) {}

  private toSignInAccountRow(row: {
    providerId: string;
    password: string | null;
    createdAt: Date;
    providerEmail: string | null;
    providerEmailHidden: boolean;
  }): SignInAccountRow {
    return {
      providerId: row.providerId,
      hasPassword: Boolean(row.password),
      createdAt: row.createdAt,
      providerEmail: openProviderEmail(row.providerEmail, this.crypto),
      providerEmailHidden: row.providerEmailHidden,
    };
  }

  async listPasskeys(subjectId: string): Promise<PasskeyRow[]> {
    const rows = await this.db
      .select({
        id: passkey.id,
        name: passkey.name,
        deviceType: passkey.deviceType,
        backedUp: passkey.backedUp,
        transports: passkey.transports,
        createdAt: passkey.createdAt,
        lastUsedAt: passkey.lastUsedAt,
      })
      .from(passkey)
      .where(eq(passkey.userId, subjectId))
      .orderBy(asc(passkey.createdAt), asc(passkey.id));
    return rows;
  }

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

  async listSignInAccounts(subjectId: string): Promise<SignInAccountRow[]> {
    const rows = await this.db
      .select(SIGN_IN_ACCOUNT_COLUMNS)
      .from(account)
      .where(eq(account.userId, subjectId));
    return rows.map((row) => this.toSignInAccountRow(row));
  }

  async lockSignInAccounts(
    transaction: IdentityOperationTransaction,
    subjectId: string,
  ): Promise<SignInAccountRow[]> {
    const rows = await identityOperationDb(this.db, transaction)
      .select(SIGN_IN_ACCOUNT_COLUMNS)
      .from(account)
      .where(eq(account.userId, subjectId))
      .for("update");
    return rows.map((row) => this.toSignInAccountRow(row));
  }

  async deleteSocialAccount(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    provider: SocialSignInProvider,
  ): Promise<boolean> {
    const deleted = await identityOperationDb(this.db, transaction)
      .delete(account)
      .where(and(eq(account.userId, subjectId), eq(account.providerId, provider)))
      .returning({ id: account.id });
    return deleted.length > 0;
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

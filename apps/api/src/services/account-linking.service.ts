import type { Database } from "@auction/db";
import { externalAccount, user } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";

export type ExternalProvider = "apple" | "google" | "shopify" | "wordpress";

export type LinkExternalAccountInput = {
  provider: ExternalProvider;
  externalId: string;
  email?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function isApplePrivateRelay(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith("@privaterelay.appleid.com"));
}

export class AccountLinkingService {
  constructor(private readonly db: Database) {}

  async link(input: LinkExternalAccountInput): Promise<{ userId: string | null; linked: boolean }> {
    const existing = await this.db
      .select({ userId: externalAccount.userId })
      .from(externalAccount)
      .where(
        and(
          eq(externalAccount.provider, input.provider),
          eq(externalAccount.externalId, input.externalId),
        ),
      )
      .limit(1);
    if (existing[0]?.userId) {
      return { userId: existing[0].userId, linked: false };
    }

    const canonicalUserId =
      input.userId ??
      (input.provider === "apple" && isApplePrivateRelay(input.email)
        ? null
        : await this.findVerifiedUserByEmail(input.email));

    if (!canonicalUserId) {
      return { userId: null, linked: false };
    }

    await this.db
      .insert(externalAccount)
      .values({
        userId: canonicalUserId,
        provider: input.provider,
        externalId: input.externalId,
        email: input.email ?? null,
        metadata: input.metadata ?? {},
      })
      .onConflictDoNothing();

    return { userId: canonicalUserId, linked: true };
  }

  private async findVerifiedUserByEmail(email: string | null | undefined): Promise<string | null> {
    if (!email) return null;
    const rows = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, email.toLowerCase()), eq(user.emailVerified, true)))
      .limit(1);
    return rows[0]?.id ?? null;
  }
}

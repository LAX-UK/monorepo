import type { Database } from "@auction/db";
import { shopArtist, shopParty, shopPayeeConnectAccount } from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { ShopConnectAccountFlags } from "../application/ports/shop-connect.gateway.js";
import { resolvePortalPartyIds } from "./portal-party-ids.js";

export type ShopPayeeConnectAccountRow = typeof shopPayeeConnectAccount.$inferSelect;

/**
 * One connected account per person per Stripe platform. A person may own several parties
 * (collector party plus linked artist party); all of them pay out to the same account.
 */
export function createDrizzleShopPayeeConnectAccountRepository(db: Database, platformKey: string) {
  async function findForPartyIds(partyIds: string[]): Promise<ShopPayeeConnectAccountRow | null> {
    if (partyIds.length === 0) return null;
    const rows = await db
      .select()
      .from(shopPayeeConnectAccount)
      .where(
        and(
          inArray(shopPayeeConnectAccount.partyId, partyIds),
          eq(shopPayeeConnectAccount.stripePlatformKey, platformKey),
        ),
      );
    for (const partyId of partyIds) {
      const row = rows.find((candidate) => candidate.partyId === partyId);
      if (row) return row;
    }
    return null;
  }

  async function subjectForParty(partyId: string): Promise<string | null> {
    const [party] = await db
      .select({ identitySubjectId: shopParty.identitySubjectId })
      .from(shopParty)
      .where(eq(shopParty.id, partyId))
      .limit(1);
    if (party?.identitySubjectId) return party.identitySubjectId;
    const [artist] = await db
      .select({ identitySubjectId: shopArtist.identitySubjectId })
      .from(shopArtist)
      .where(eq(shopArtist.partyId, partyId))
      .limit(1);
    return artist?.identitySubjectId ?? null;
  }

  return {
    payeePartyIdsForSubject: (identitySubjectId: string) =>
      resolvePortalPartyIds(db, identitySubjectId),

    findForPartyIds,

    async findForParty(partyId: string): Promise<ShopPayeeConnectAccountRow | null> {
      const subject = await subjectForParty(partyId);
      const partyIds = subject ? await resolvePortalPartyIds(db, subject) : [partyId];
      return findForPartyIds(partyIds.includes(partyId) ? partyIds : [partyId, ...partyIds]);
    },

    async insertIfAbsent(partyId: string, stripeConnectAccountId: string): Promise<void> {
      await db
        .insert(shopPayeeConnectAccount)
        .values({ partyId, stripePlatformKey: platformKey, stripeConnectAccountId })
        .onConflictDoNothing();
    },

    /** Returns false when the account is unknown on this platform (orphan or other platform). */
    async applyFlags(flags: ShopConnectAccountFlags): Promise<boolean> {
      const updated = await db
        .update(shopPayeeConnectAccount)
        .set({
          chargesEnabled: flags.chargesEnabled,
          payoutsEnabled: flags.payoutsEnabled,
          requirementsCurrentlyDue: flags.requirementsCurrentlyDue,
          disabledReason: flags.disabledReason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(shopPayeeConnectAccount.stripeConnectAccountId, flags.stripeAccountId),
            eq(shopPayeeConnectAccount.stripePlatformKey, platformKey),
          ),
        )
        .returning({ id: shopPayeeConnectAccount.id });
      return updated.length === 1;
    },
  };
}

export type ShopPayeeConnectAccountRepository = ReturnType<
  typeof createDrizzleShopPayeeConnectAccountRepository
>;

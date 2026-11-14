import type { Database } from "@auction/db";
import { shopArtist, shopParty, shopPayeeConnectAccount } from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { ShopConnectAccountFlags } from "../application/ports/shop-connect.gateway.js";
import { type PortalPartyScope, resolvePortalPartyScope } from "./portal-party-scope.js";

export type ShopPayeeConnectAccountRow = typeof shopPayeeConnectAccount.$inferSelect;

/**
 * One connected account per person per Stripe platform. A person may own several parties (their
 * own party plus the artist party they own); all of them pay out to the same account. Which
 * parties a person owns follows `portal-party-scope.ts`: a party reached only through an artist
 * profile on someone else's party, or on a party several artists share, is never theirs here.
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

  /** The person whose payout account a party pays into: its own sign-in, or its only artist. */
  async function subjectForParty(partyId: string): Promise<string | null> {
    const [party] = await db
      .select({ identitySubjectId: shopParty.identitySubjectId })
      .from(shopParty)
      .where(eq(shopParty.id, partyId))
      .limit(1);
    if (party?.identitySubjectId) return party.identitySubjectId;
    const artists = await db
      .select({ identitySubjectId: shopArtist.identitySubjectId })
      .from(shopArtist)
      .where(eq(shopArtist.partyId, partyId))
      .limit(2);
    return artists.length === 1 ? (artists[0]?.identitySubjectId ?? null) : null;
  }

  return {
    payeeScopeForSubject: (identitySubjectId: string): Promise<PortalPartyScope> =>
      resolvePortalPartyScope(db, identitySubjectId),

    findForPartyIds,

    async findForParty(partyId: string): Promise<ShopPayeeConnectAccountRow | null> {
      const subject = await subjectForParty(partyId);
      const owned = subject ? (await resolvePortalPartyScope(db, subject)).ownedPartyIds : [];
      return findForPartyIds(owned.includes(partyId) ? owned : [partyId]);
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

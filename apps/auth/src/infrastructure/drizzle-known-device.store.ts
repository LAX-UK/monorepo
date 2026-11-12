import type { IdentityDatabase } from "@auction/identity-db";
import { authKnownDevice } from "@auction/identity-db/schema";
import { and, count, eq, gte, inArray, ne } from "drizzle-orm";
import {
  KNOWN_DEVICE_WINDOW_MS,
  type KnownDeviceStore,
  fingerprintMarker,
  fingerprintMarkerOwingNotice,
} from "../services/known-device.js";

/**
 * Called in the same transaction that deletes sign-in records the person (or a reset) ended: each
 * browser's marker stops vouching for it, and the browser is flagged as owing a new sign-in email,
 * so signing in from it again is reported even though its label and country were seen recently.
 * Records without a marker hash (made before the marker existed) have nothing to forget.
 */
export async function retireRevokedBrowserMarkers(
  db: Pick<IdentityDatabase, "delete" | "insert">,
  input: { userId: string; deviceHashes: readonly (string | null)[]; at: Date },
): Promise<void> {
  const hashes = [...new Set(input.deviceHashes.filter((hash): hash is string => Boolean(hash)))];
  if (hashes.length === 0) return;
  const known = hashes.map((deviceHash) => fingerprintMarker({ userId: input.userId, deviceHash }));
  await db
    .delete(authKnownDevice)
    .where(
      and(eq(authKnownDevice.userId, input.userId), inArray(authKnownDevice.fingerprint, known)),
    );
  await db
    .insert(authKnownDevice)
    .values(
      hashes.map((deviceHash) => ({
        userId: input.userId,
        fingerprint: fingerprintMarkerOwingNotice({ userId: input.userId, deviceHash }),
        firstSeenAt: input.at,
        lastSeenAt: input.at,
      })),
    )
    .onConflictDoUpdate({
      target: [authKnownDevice.userId, authKnownDevice.fingerprint],
      set: { lastSeenAt: input.at },
    });
}

export class DrizzleKnownDeviceStore implements KnownDeviceStore {
  constructor(private readonly db: IdentityDatabase) {}

  touch(input: { userId: string; fingerprint: string; at: Date }) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ lastSeenAt: authKnownDevice.lastSeenAt })
        .from(authKnownDevice)
        .where(
          and(
            eq(authKnownDevice.userId, input.userId),
            eq(authKnownDevice.fingerprint, input.fingerprint),
          ),
        )
        .for("update");
      const [others] = await tx
        .select({ value: count() })
        .from(authKnownDevice)
        .where(
          and(
            eq(authKnownDevice.userId, input.userId),
            ne(authKnownDevice.fingerprint, input.fingerprint),
          ),
        );
      await tx
        .insert(authKnownDevice)
        .values({
          userId: input.userId,
          fingerprint: input.fingerprint,
          firstSeenAt: input.at,
          lastSeenAt: input.at,
        })
        .onConflictDoUpdate({
          target: [authKnownDevice.userId, authKnownDevice.fingerprint],
          set: { lastSeenAt: input.at },
        });
      return {
        previousLastSeenAt: existing?.lastSeenAt ?? null,
        hadOtherDevices: (others?.value ?? 0) > 0,
      };
    });
  }

  async hasSeen(input: { userId: string; fingerprint: string; at: Date }): Promise<boolean> {
    const since = new Date(input.at.getTime() - KNOWN_DEVICE_WINDOW_MS);
    const [row] = await this.db
      .select({ value: count() })
      .from(authKnownDevice)
      .where(
        and(
          eq(authKnownDevice.userId, input.userId),
          eq(authKnownDevice.fingerprint, input.fingerprint),
          gte(authKnownDevice.lastSeenAt, since),
        ),
      );
    return (row?.value ?? 0) > 0;
  }

  async forget(input: { userId: string; fingerprints: readonly string[] }): Promise<void> {
    if (input.fingerprints.length === 0) return;
    await this.db
      .delete(authKnownDevice)
      .where(
        and(
          eq(authKnownDevice.userId, input.userId),
          inArray(authKnownDevice.fingerprint, [...input.fingerprints]),
        ),
      );
  }

  /** Forgets the browser holding this marker hash, as signing out of that browser does. */
  forgetBrowser(input: { userId: string; deviceHash: string }): Promise<void> {
    return this.forget({
      userId: input.userId,
      fingerprints: [fingerprintMarker(input)],
    });
  }

  async remember(input: { userId: string; fingerprint: string; at: Date }): Promise<void> {
    await this.db
      .insert(authKnownDevice)
      .values({
        userId: input.userId,
        fingerprint: input.fingerprint,
        firstSeenAt: input.at,
        lastSeenAt: input.at,
      })
      .onConflictDoUpdate({
        target: [authKnownDevice.userId, authKnownDevice.fingerprint],
        set: { lastSeenAt: input.at },
      });
  }

  async countNoticesSince(userId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(authKnownDevice)
      .where(and(eq(authKnownDevice.userId, userId), gte(authKnownDevice.notifiedAt, since)));
    return row?.value ?? 0;
  }

  async markNotified(input: { userId: string; fingerprint: string; at: Date }): Promise<void> {
    await this.db
      .update(authKnownDevice)
      .set({ notifiedAt: input.at })
      .where(
        and(
          eq(authKnownDevice.userId, input.userId),
          eq(authKnownDevice.fingerprint, input.fingerprint),
        ),
      );
  }
}

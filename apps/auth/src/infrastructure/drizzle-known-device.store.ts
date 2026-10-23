import type { IdentityDatabase } from "@auction/identity-db";
import { authKnownDevice } from "@auction/identity-db/schema";
import { and, count, eq, gte, ne } from "drizzle-orm";
import type { KnownDeviceStore } from "../services/known-device.js";

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

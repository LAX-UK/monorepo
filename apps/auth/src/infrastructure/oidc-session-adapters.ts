import type { Database } from "@auction/db";
import { oidcRpSession, session } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { Redis } from "ioredis";
import type {
  OidcCodeCorrelationStore,
  OidcRpSessionRepository,
} from "../services/oidc-session-coordinator.js";

const CORRELATION_KEY_PREFIX = "oidc:authorization-session:";

export class RedisOidcCodeCorrelationStore implements OidcCodeCorrelationStore {
  constructor(private readonly redis: Redis) {}

  async putIfAbsent(codeHash: string, identitySessionId: string, ttlSec: number): Promise<boolean> {
    return (
      (await this.redis.set(
        `${CORRELATION_KEY_PREFIX}${codeHash}`,
        identitySessionId,
        "EX",
        ttlSec,
        "NX",
      )) === "OK"
    );
  }

  async consume(codeHash: string): Promise<string | null> {
    return this.redis.getdel(`${CORRELATION_KEY_PREFIX}${codeHash}`);
  }
}

export class DrizzleOidcRpSessionRepository implements OidcRpSessionRepository {
  constructor(private readonly db: Database) {}

  async findIdentitySession(identitySessionId: string) {
    const [row] = await this.db
      .select({
        id: session.id,
        subjectId: session.userId,
        createdAt: session.createdAt,
        lastPasswordAuthAt: session.lastPasswordAuthAt,
        mfaCompletedAt: session.mfaCompletedAt,
        lastStepUpAt: session.lastStepUpAt,
      })
      .from(session)
      .where(eq(session.id, identitySessionId))
      .limit(1);
    return row ?? null;
  }

  async upsertRpSession(input: {
    clientId: string;
    subjectId: string;
    sid: string;
    identitySessionId: string;
    seenAt: Date;
  }): Promise<void> {
    await this.db
      .insert(oidcRpSession)
      .values({
        clientId: input.clientId,
        subjectId: input.subjectId,
        sid: input.sid,
        identitySessionId: input.identitySessionId,
        createdAt: input.seenAt,
        updatedAt: input.seenAt,
        lastSeenAt: input.seenAt,
        revokedAt: null,
      })
      .onConflictDoUpdate({
        target: [oidcRpSession.clientId, oidcRpSession.sid],
        set: {
          subjectId: input.subjectId,
          identitySessionId: input.identitySessionId,
          updatedAt: input.seenAt,
          lastSeenAt: input.seenAt,
          revokedAt: null,
        },
      });
  }
}

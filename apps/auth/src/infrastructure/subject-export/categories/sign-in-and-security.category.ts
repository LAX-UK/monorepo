import { formatDeviceLabel } from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import {
  account,
  authKnownDevice,
  identityLifecycleOutbox,
  passkey,
  session,
  user,
} from "@auction/identity-db/schema";
import { and, asc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import {
  type ExportSource,
  SourcedExportCategory,
  inMemorySource,
} from "../../../subject-export/sourced-export-category.js";
import { iso, isoRequired } from "../../../subject-export/values.js";
import { afterKey, afterNumericKey, countWhere, numericKey } from "./keyset.js";

const CREDENTIAL_PROVIDER = "credential";

export function mapTwoStep(enabled: boolean) {
  return {
    id: "two-step",
    origin: "observed" as const,
    kind: "two_step",
    twoStepEnabled: enabled,
    // The date two-step was switched on is not stored. Its secret and backup codes are never read.
    changedAt: null,
  };
}

export function mapPasswordMethod(row: { passwordSet: boolean; changedAt: Date | null } | null) {
  return {
    id: "password",
    origin: "observed" as const,
    kind: "sign_in_method",
    method: "password",
    methodName: null,
    passwordSet: row?.passwordSet ?? false,
    changedAt: iso(row?.changedAt),
  };
}

/**
 * A social sign-in: the provider, the address it reported when there is one, and when it was
 * linked. The provider's tokens and its own identifier for the person are never read.
 */
export function mapSocialMethod(row: {
  id: string;
  providerId: string;
  createdAt: Date;
  providerEmail?: string | null;
}) {
  return {
    id: row.id,
    origin: "observed" as const,
    kind: "sign_in_method",
    method: row.providerId,
    methodName: row.providerEmail ? `${row.providerId} (${row.providerEmail})` : row.providerId,
    changedAt: isoRequired(row.createdAt),
  };
}

/**
 * A passkey: the name the person gave it and the dates. The public key, credential identifier,
 * counter and authenticator model are never selected, so none can reach the file.
 */
export function mapPasskeyMethod(row: {
  id: string;
  name: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}) {
  return {
    id: `passkey-${row.id}`,
    origin: "observed" as const,
    kind: "sign_in_method",
    method: "passkey",
    methodName: row.name?.trim() || "Passkey",
    changedAt: isoRequired(row.createdAt),
    lastUsedAt: iso(row.lastUsedAt),
  };
}

export function mapSession(
  row: {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: Date;
    expiresAt: Date;
    amr?: readonly string[] | null;
  },
  now: Date,
) {
  return {
    id: row.id,
    origin: "observed" as const,
    kind: "session",
    device: formatDeviceLabel(row.userAgent),
    signedInWith: [...(row.amr ?? [])],
    ipAddress: row.ipAddress,
    // No place is derived from the address when a session starts, so none is held.
    approximateLocation: null,
    startedAt: isoRequired(row.createdAt),
    endedAt: row.expiresAt <= now ? isoRequired(row.expiresAt) : null,
  };
}

/** The device table holds a hash, not a label or an address, so only the dates are reported. */
export function mapKnownDevice(row: { fingerprint: string; firstSeenAt: Date; lastSeenAt: Date }) {
  return {
    id: `device-${row.fingerprint.slice(0, 16)}`,
    origin: "observed" as const,
    kind: "device",
    device: null,
    startedAt: isoRequired(row.firstSeenAt),
    changedAt: isoRequired(row.lastSeenAt),
  };
}

export function mapNewDeviceNotice(row: { fingerprint: string; notifiedAt: Date }) {
  return {
    id: `notice-${row.fingerprint.slice(0, 16)}`,
    origin: "observed" as const,
    kind: "security_notice",
    noticeType: "new_device_sign_in",
    sentAt: isoRequired(row.notifiedAt),
  };
}

const EVENT_NAMES: Record<string, string> = {
  "user.credential_changed": "password",
  "user.session_revoked": "session_revoked",
};

export function mapSecurityEvent(row: {
  id: number;
  eventType: string;
  changeType: string | null;
  occurredAt: Date;
}) {
  const base = EVENT_NAMES[row.eventType] ?? row.eventType;
  return {
    id: `event-${numericKey(row.id)}`,
    origin: "observed" as const,
    kind: "security_event",
    noticeType: row.changeType ? `${base}_${row.changeType}` : base,
    changedAt: isoRequired(row.occurredAt),
  };
}

const SECURITY_EVENT_TYPES = Object.keys(EVENT_NAMES);

/**
 * How the person signs in and what has happened on their account. The password hash, two-step
 * secret, backup codes, session tokens, provider tokens and device hashes are never selected:
 * a password is reported only as set or not set, with the date it last changed.
 */
export class SignInAndSecurityExportCategory extends SourcedExportCategory {
  readonly id = "sign-in-and-security";
  protected readonly sources: readonly ExportSource[];

  constructor(
    db: IdentityDatabase,
    now: () => Date = () => new Date(),
    /** Opens the address a provider reported, which is stored sealed. */
    crypto: { open(sealed: string): string } | null = null,
  ) {
    super();
    const readAddress = (value: string | null): string | null => {
      if (!value) return null;
      if (!crypto) return value;
      try {
        return crypto.open(value);
      } catch {
        return null;
      }
    };
    this.sources = [
      inMemorySource(async (subjectId) => {
        const [row] = await db
          .select({ enabled: user.twoFactorEnabled })
          .from(user)
          .where(eq(user.id, subjectId))
          .limit(1);
        return row ? [{ key: "two-step", record: mapTwoStep(row.enabled) }] : [];
      }),
      inMemorySource(async (subjectId) => {
        const [row] = await db
          .select({
            // Presence only: the stored value is never returned.
            passwordSet: sql<boolean>`${account.password} is not null`,
            changedAt: account.updatedAt,
          })
          .from(account)
          .where(and(eq(account.userId, subjectId), eq(account.providerId, CREDENTIAL_PROVIDER)))
          .limit(1);
        return [{ key: "password", record: mapPasswordMethod(row ?? null) }];
      }),
      {
        count: (subjectId) =>
          countWhere(
            db,
            account,
            and(eq(account.userId, subjectId), ne(account.providerId, CREDENTIAL_PROVIDER)),
          ),
        page: async (subjectId, key, limit) => {
          const rows = await db
            .select({
              id: account.id,
              providerId: account.providerId,
              createdAt: account.createdAt,
              providerEmail: account.providerEmail,
            })
            .from(account)
            .where(
              and(
                eq(account.userId, subjectId),
                ne(account.providerId, CREDENTIAL_PROVIDER),
                afterKey(account.id, key),
              ),
            )
            .orderBy(asc(account.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapSocialMethod({ ...row, providerEmail: readAddress(row.providerEmail) }),
          }));
        },
      },
      {
        count: (subjectId) => countWhere(db, passkey, eq(passkey.userId, subjectId)),
        page: async (subjectId, key, limit) => {
          const rows = await db
            .select({
              id: passkey.id,
              name: passkey.name,
              createdAt: passkey.createdAt,
              lastUsedAt: passkey.lastUsedAt,
            })
            .from(passkey)
            .where(and(eq(passkey.userId, subjectId), afterKey(passkey.id, key)))
            .orderBy(asc(passkey.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapPasskeyMethod(row) }));
        },
      },
      {
        count: (subjectId) => countWhere(db, session, eq(session.userId, subjectId)),
        page: async (subjectId, key, limit) => {
          const rows = await db
            .select({
              id: session.id,
              userAgent: session.userAgent,
              ipAddress: session.ipAddress,
              createdAt: session.createdAt,
              expiresAt: session.expiresAt,
              amr: session.amr,
            })
            .from(session)
            .where(and(eq(session.userId, subjectId), afterKey(session.id, key)))
            .orderBy(asc(session.id))
            .limit(limit);
          const at = now();
          return rows.map((row) => ({ key: row.id, record: mapSession(row, at) }));
        },
      },
      {
        count: (subjectId) =>
          countWhere(db, authKnownDevice, eq(authKnownDevice.userId, subjectId)),
        page: async (subjectId, key, limit) => {
          const rows = await db
            .select({
              fingerprint: authKnownDevice.fingerprint,
              firstSeenAt: authKnownDevice.firstSeenAt,
              lastSeenAt: authKnownDevice.lastSeenAt,
            })
            .from(authKnownDevice)
            .where(
              and(
                eq(authKnownDevice.userId, subjectId),
                afterKey(authKnownDevice.fingerprint, key),
              ),
            )
            .orderBy(asc(authKnownDevice.fingerprint))
            .limit(limit);
          return rows.map((row) => ({ key: row.fingerprint, record: mapKnownDevice(row) }));
        },
      },
      {
        count: (subjectId) =>
          countWhere(
            db,
            authKnownDevice,
            and(eq(authKnownDevice.userId, subjectId), isNotNull(authKnownDevice.notifiedAt)),
          ),
        page: async (subjectId, key, limit) => {
          const rows = await db
            .select({
              fingerprint: authKnownDevice.fingerprint,
              notifiedAt: authKnownDevice.notifiedAt,
            })
            .from(authKnownDevice)
            .where(
              and(
                eq(authKnownDevice.userId, subjectId),
                isNotNull(authKnownDevice.notifiedAt),
                afterKey(authKnownDevice.fingerprint, key),
              ),
            )
            .orderBy(asc(authKnownDevice.fingerprint))
            .limit(limit);
          return rows.flatMap((row) =>
            row.notifiedAt
              ? [
                  {
                    key: row.fingerprint,
                    record: mapNewDeviceNotice({
                      fingerprint: row.fingerprint,
                      notifiedAt: row.notifiedAt,
                    }),
                  },
                ]
              : [],
          );
        },
      },
      {
        count: (subjectId) => countWhere(db, identityLifecycleOutbox, securityEvents(subjectId)),
        page: async (subjectId, key, limit) => {
          const rows = await db
            .select({
              id: identityLifecycleOutbox.id,
              eventType: identityLifecycleOutbox.eventType,
              changeType: sql<string | null>`${identityLifecycleOutbox.payload}->>'changeType'`,
              occurredAt: identityLifecycleOutbox.occurredAt,
            })
            .from(identityLifecycleOutbox)
            .where(and(securityEvents(subjectId), afterNumericKey(identityLifecycleOutbox.id, key)))
            .orderBy(asc(identityLifecycleOutbox.id))
            .limit(limit);
          return rows.map((row) => ({ key: numericKey(row.id), record: mapSecurityEvent(row) }));
        },
      },
    ];
  }
}

function securityEvents(subjectId: string) {
  return and(
    eq(identityLifecycleOutbox.aggregateType, "user"),
    eq(identityLifecycleOutbox.aggregateId, subjectId),
    inArray(identityLifecycleOutbox.eventType, SECURITY_EVENT_TYPES),
  );
}

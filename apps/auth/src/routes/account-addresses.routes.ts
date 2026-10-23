import {
  ACCOUNT_ADDRESSES_CREATE_PATH,
  ACCOUNT_ADDRESSES_DEFAULT_PATH,
  ACCOUNT_ADDRESSES_DELETE_PATH,
  ACCOUNT_ADDRESSES_PATH,
  ACCOUNT_ADDRESSES_UPDATE_PATH,
  ACCOUNT_REAUTH_REQUIRED,
  type AccountAddress,
  accountAddressDefaultKindSchema,
  accountAddressInputSchema,
} from "@auction/identity-contracts";
import { type Context, Hono } from "hono";
import type { IdentityAddressRow } from "../services/identity-address.ports.js";
import type { IdentityAddressService } from "../services/identity-address.service.js";
import type { RecentSessionGuard } from "../services/recent-session-guard.js";
import { type AccountCallerDeps, authenticateAccountCaller } from "./account-caller.js";

export type AccountAddressRouteDeps = Omit<AccountCallerDeps, "rateLimit"> & {
  addresses: Pick<IdentityAddressService, "list" | "create" | "update" | "delete" | "setDefault">;
  sessions: Pick<RecentSessionGuard, "findRecent">;
  /** Budget for reads. */
  readRateLimit: AccountCallerDeps["rateLimit"];
  /** Tighter per-person budget for changes. */
  writeRateLimit: AccountCallerDeps["rateLimit"];
  onFailure?: (error: unknown) => void;
};

/** The wire shape of an address, picked field by field so a new column is never exposed by accident. */
export function toAccountAddress(row: IdentityAddressRow): AccountAddress {
  return {
    id: row.id,
    label: row.label,
    recipientName: row.recipientName,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    region: row.region,
    postcode: row.postcode,
    country: row.country,
    phone: row.phone,
    isDefaultShipping: row.isDefaultShipping,
    isDefaultBilling: row.isDefaultBilling,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The address a request carries, as a JSON form field; null when it is missing or invalid. */
export function readAddressFields(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return parseAddressFields(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function parseAddressFields(value: unknown) {
  const parsed = accountAddressInputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** A malformed id is answered as a bad request instead of reaching the database as a type error. */
export function readAddressId(raw: string | null | undefined): string | null {
  return raw && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
    ? raw
    : null;
}

export function readExpectedVersion(raw: string | null | undefined): number | null {
  if (!raw || !/^[1-9]\d{0,8}$/.test(raw)) return null;
  return Number(raw);
}

/**
 * Lets LAX Account manage the signed-in person's LAX-wide address book. Reads and "make
 * default" need only the person's token; adding, editing and deleting an address also need a
 * recent sign-in (`sid`, checked against the person's live sessions), because a changed delivery
 * address is a way to redirect someone's purchases. A stale edit is refused with
 * `version_conflict` rather than overwriting a change made in another tab or product.
 */
export function createAccountAddressRoutes(deps: AccountAddressRouteDeps) {
  const app = new Hono();
  const reads: AccountCallerDeps = { ...deps, rateLimit: deps.readRateLimit };
  const writes: AccountCallerDeps = { ...deps, rateLimit: deps.writeRateLimit };

  async function guarded(c: Context, run: () => Promise<Response>): Promise<Response> {
    try {
      return await run();
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  }

  const refuse = (c: Context, reason: string) =>
    c.json({ error: reason }, reason === "address_not_found" ? 404 : 409);

  async function requireRecentSignIn(subjectId: string, sid: string | null): Promise<boolean> {
    return sid !== null && (await deps.sessions.findRecent(subjectId, sid)) !== null;
  }

  app.post(ACCOUNT_ADDRESSES_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, reads);
    if (caller instanceof Response) return caller;
    return guarded(c, async () =>
      c.json({ addresses: (await deps.addresses.list(caller.subjectId)).map(toAccountAddress) }),
    );
  });

  app.post(ACCOUNT_ADDRESSES_CREATE_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, writes);
    if (caller instanceof Response) return caller;
    const fields = readAddressFields(caller.params.get("address"));
    if (!fields) return c.json({ error: "invalid_address" }, 400);
    return guarded(c, async () => {
      if (!(await requireRecentSignIn(caller.subjectId, caller.params.get("sid")))) {
        return c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403);
      }
      const result = await deps.addresses.create(caller.subjectId, fields);
      return result.ok
        ? c.json({ address: toAccountAddress(result.address) })
        : c.json({ error: result.reason }, 409);
    });
  });

  app.post(ACCOUNT_ADDRESSES_UPDATE_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, writes);
    if (caller instanceof Response) return caller;
    const addressId = readAddressId(caller.params.get("address_id"));
    const version = readExpectedVersion(caller.params.get("expected_version"));
    const fields = readAddressFields(caller.params.get("address"));
    if (!addressId || version === null || !fields) return c.json({ error: "invalid_address" }, 400);
    return guarded(c, async () => {
      if (!(await requireRecentSignIn(caller.subjectId, caller.params.get("sid")))) {
        return c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403);
      }
      const result = await deps.addresses.update(caller.subjectId, addressId, version, fields);
      return result.ok
        ? c.json({ address: toAccountAddress(result.address) })
        : refuse(c, result.reason);
    });
  });

  app.post(ACCOUNT_ADDRESSES_DELETE_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, writes);
    if (caller instanceof Response) return caller;
    const addressId = readAddressId(caller.params.get("address_id"));
    const version = readExpectedVersion(caller.params.get("expected_version"));
    if (!addressId || version === null) return c.json({ error: "invalid_address" }, 400);
    return guarded(c, async () => {
      if (!(await requireRecentSignIn(caller.subjectId, caller.params.get("sid")))) {
        return c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403);
      }
      const result = await deps.addresses.delete(caller.subjectId, addressId, version);
      return result.ok ? c.json({ deleted: true }) : refuse(c, result.reason);
    });
  });

  app.post(ACCOUNT_ADDRESSES_DEFAULT_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, writes);
    if (caller instanceof Response) return caller;
    const addressId = readAddressId(caller.params.get("address_id"));
    const kind = accountAddressDefaultKindSchema.safeParse(caller.params.get("kind"));
    if (!addressId || !kind.success) return c.json({ error: "invalid_address" }, 400);
    return guarded(c, async () => {
      const result = await deps.addresses.setDefault(caller.subjectId, addressId, kind.data);
      return result.ok
        ? c.json({ address: toAccountAddress(result.address) })
        : refuse(c, result.reason);
    });
  });

  return app;
}

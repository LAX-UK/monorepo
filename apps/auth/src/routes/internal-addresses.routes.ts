import { accountAddressDefaultKindSchema } from "@auction/identity-contracts";
import type { Context, Hono } from "hono";
import type { IdentityAddressService } from "../services/identity-address.service.js";
import {
  parseAddressFields,
  readAddressId,
  readExpectedVersion,
  toAccountAddress,
} from "./account-addresses.routes.js";

export type InternalAddressRouteDeps = {
  addresses: Pick<IdentityAddressService, "list" | "create" | "update" | "delete" | "setDefault">;
};

const STATUS = {
  address_not_found: 404,
  version_conflict: 409,
  address_limit_reached: 409,
} as const;

async function readBody(c: Context): Promise<Record<string, unknown>> {
  return (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
}

const asText = (value: unknown): string | null => (typeof value === "string" ? value : null);

/**
 * Machine-only address routes for products (Bid, Shop, Art). The product has already
 * authenticated its own user and names the subject; Identity trusts the machine credential,
 * as it does for the other `/identity/subjects/*` routes. There is no sign-in recency check here:
 * the person is acting inside a product, not changing their account.
 */
export function mountInternalAddressRoutes(app: Hono, deps: InternalAddressRouteDeps): void {
  const base = "/identity/subjects/:subjectId/addresses";

  app.get(base, async (c) =>
    c.json({
      addresses: (await deps.addresses.list(c.req.param("subjectId"))).map(toAccountAddress),
    }),
  );

  app.post(base, async (c) => {
    const fields = parseAddressFields((await readBody(c)).address);
    if (!fields) return c.json({ error: "invalid_address" }, 400);
    const result = await deps.addresses.create(c.req.param("subjectId"), fields);
    return result.ok
      ? c.json({ address: toAccountAddress(result.address) })
      : c.json({ error: result.reason }, STATUS[result.reason]);
  });

  app.patch(`${base}/:addressId`, async (c) => {
    const body = await readBody(c);
    const addressId = readAddressId(c.req.param("addressId"));
    const version = readExpectedVersion(String(body.expectedVersion ?? ""));
    const fields = parseAddressFields(body.address);
    if (!addressId || version === null || !fields) return c.json({ error: "invalid_address" }, 400);
    const result = await deps.addresses.update(
      c.req.param("subjectId"),
      addressId,
      version,
      fields,
    );
    return result.ok
      ? c.json({ address: toAccountAddress(result.address) })
      : c.json({ error: result.reason }, STATUS[result.reason]);
  });

  app.delete(`${base}/:addressId`, async (c) => {
    const addressId = readAddressId(c.req.param("addressId"));
    const version = readExpectedVersion(c.req.query("expectedVersion"));
    if (!addressId || version === null) return c.json({ error: "invalid_address" }, 400);
    const result = await deps.addresses.delete(c.req.param("subjectId"), addressId, version);
    return result.ok
      ? c.json({ deleted: true })
      : c.json({ error: result.reason }, STATUS[result.reason]);
  });

  app.post(`${base}/:addressId/default`, async (c) => {
    const addressId = readAddressId(c.req.param("addressId"));
    const kind = accountAddressDefaultKindSchema.safeParse(asText((await readBody(c)).kind));
    if (!addressId || !kind.success) return c.json({ error: "invalid_address" }, 400);
    const result = await deps.addresses.setDefault(c.req.param("subjectId"), addressId, kind.data);
    return result.ok
      ? c.json({ address: toAccountAddress(result.address) })
      : c.json({ error: result.reason }, STATUS[result.reason]);
  });
}

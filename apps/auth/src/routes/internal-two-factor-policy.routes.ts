import {
  TWO_FACTOR_POLICY_DEFAULTS,
  type TwoFactorPolicyScope,
  type TwoFactorPolicyStore,
} from "@auction/auth";
import type { Context, Hono } from "hono";
import type { TwoFactorRequirementReader } from "../services/two-factor-requirement.service.js";

const MAX_STATUS_BATCH = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TwoFactorPolicyRouteDeps = {
  store: TwoFactorPolicyStore;
  readRequirement: TwoFactorRequirementReader;
  now?: () => Date;
};

async function policyView(store: TwoFactorPolicyStore, scope: TwoFactorPolicyScope) {
  const [record, coverage] = await Promise.all([
    store.readPolicy(scope),
    store.countCoverage(scope),
  ]);
  return {
    policy: {
      required: record?.required ?? TWO_FACTOR_POLICY_DEFAULTS[scope.scope],
      setBySubjectId: record?.setBySubjectId ?? null,
      setAt: record?.setAt.toISOString() ?? null,
    },
    coverage,
  };
}

async function readPolicyWrite(c: Context): Promise<{ required: boolean; actor: string } | null> {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.required !== "boolean") return null;
  if (typeof body.actorSubjectId !== "string" || !body.actorSubjectId) return null;
  return { required: body.required, actor: body.actorSubjectId };
}

/**
 * Machine-only routes for Bid admin surfaces (D35). Products decide *who* may change a
 * policy; Identity stores it and enforces it at authorize.
 */
export function mountTwoFactorPolicyRoutes(app: Hono, deps: TwoFactorPolicyRouteDeps): void {
  const now = deps.now ?? (() => new Date());

  app.get("/identity/subjects/:subjectId/two-factor-requirement", async (c) =>
    c.json({ requirement: await deps.readRequirement(c.req.param("subjectId")) }),
  );

  app.post("/identity/subjects/two-factor-status", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { subjectIds?: unknown };
    const ids = Array.isArray(body.subjectIds)
      ? body.subjectIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : null;
    if (!ids || ids.length > MAX_STATUS_BATCH) {
      return c.json({ error: "subject_ids_required" }, 400);
    }
    const enabled = await deps.store.readTwoFactorEnabled([...new Set(ids)]);
    return c.json({
      statuses: [...enabled].map(([subjectId, twoFactorEnabled]) => ({
        subjectId,
        twoFactorEnabled,
      })),
    });
  });

  app.get("/identity/two-factor-policies/staff", async (c) =>
    c.json(await policyView(deps.store, { scope: "staff" })),
  );

  app.put("/identity/two-factor-policies/staff", async (c) => {
    const input = await readPolicyWrite(c);
    if (!input) return c.json({ error: "required_and_actor_required" }, 400);
    const scope = { scope: "staff" } as const;
    await deps.store.writePolicy(scope, {
      required: input.required,
      setBySubjectId: input.actor,
      at: now(),
    });
    return c.json(await policyView(deps.store, scope));
  });

  app.get("/identity/two-factor-policies/orgs/:legalEntityId", async (c) => {
    const legalEntityId = c.req.param("legalEntityId");
    if (!UUID.test(legalEntityId)) return c.json({ error: "invalid_legal_entity_id" }, 400);
    return c.json(await policyView(deps.store, { scope: "org", legalEntityId }));
  });

  app.put("/identity/two-factor-policies/orgs/:legalEntityId", async (c) => {
    const legalEntityId = c.req.param("legalEntityId");
    if (!UUID.test(legalEntityId)) return c.json({ error: "invalid_legal_entity_id" }, 400);
    const input = await readPolicyWrite(c);
    if (!input) return c.json({ error: "required_and_actor_required" }, 400);
    const scope = { scope: "org", legalEntityId } as const;
    await deps.store.writePolicy(scope, {
      required: input.required,
      setBySubjectId: input.actor,
      at: now(),
    });
    return c.json(await policyView(deps.store, scope));
  });
}

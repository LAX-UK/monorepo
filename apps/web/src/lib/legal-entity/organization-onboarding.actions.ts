"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { normalizeApiErrorMessage } from "@auction/validators";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { CreateOrganizationInput } from "@auction/validators";

export type CheckNameResult = { available: boolean; suggestions: string[] };

export type CreateOrganizationActionResult =
  | {
      ok: true;
      entity: {
        id: string;
        displayName: string;
        slug: string | null;
      };
      nextSteps: string[];
    }
  | { ok: false; error: string };

export async function checkOrgNameAction(displayName: string): Promise<CheckNameResult> {
  return instrumentServerAction("checkOrgNameAction", async () => {
    const res = await authedServerFetch(
      `/organizations/check-name?displayName=${encodeURIComponent(displayName)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { available: false, suggestions: [] };
    const body = (await res.json()) as { data: CheckNameResult };
    return body.data;
  });
}

export async function createOrganizationAction(
  input: CreateOrganizationInput,
): Promise<CreateOrganizationActionResult> {
  return instrumentServerAction("createOrganizationAction", async () => {
    const res = await authedServerFetch("/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await res.json()) as
      | {
          data: {
            entity: { id: string; displayName: string; slug: string | null };
            nextSteps: string[];
          };
        }
      | { error: unknown };
    if (!res.ok) {
      return {
        ok: false,
        error: normalizeApiErrorMessage("error" in body ? body.error : undefined, "create_failed"),
      };
    }
    if (!("data" in body)) return { ok: false, error: "create_failed" };
    return {
      ok: true,
      entity: body.data.entity,
      nextSteps: body.data.nextSteps,
    };
  });
}

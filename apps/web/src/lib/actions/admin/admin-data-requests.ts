"use server";

import { dataRequestErrorMessage } from "@/lib/admin/data-requests/data-request-errors";
import { DATA_REQUESTS_PATH } from "@/lib/admin/data-requests/data-requests-search";
import {
  type EnquiryErasureCounts,
  enquiryErasureCountsSchema,
  erasureErrorMessage,
  validateErasure,
} from "@/lib/admin/data-requests/enquiry-erasure";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { DATA_REQUESTS_MANAGE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  type DataRequestRecord,
  closeDataRequestBodySchema,
  createDataRequestBodySchema,
  dataRequestRecordSchema,
  extendDataRequestBodySchema,
  patchDataRequestBodySchema,
} from "@auction/identity-contracts/data-requests";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { z as zod } from "zod";

const API = "/admin/data-requests";

/** A person's LAX account as the Log dialog shows it: found by their full email address. */
export type FoundAccountResult = { subjectId: string; name: string; status: string };

const foundAccountSchema = zod
  .object({ subjectId: zod.string(), name: zod.string(), status: zod.string() })
  .nullable();

async function errorCodeOf(res: Response): Promise<string | undefined> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : undefined;
}

/**
 * Sends one change to the Bid API and returns the request as it is afterwards. A refusal keeps
 * Identity's code, so the page can tell a stale edit (reload) from a rule (say which) from an
 * outage (try again).
 */
async function send(
  name: string,
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  schema: z.ZodType | null,
  reference: string | null,
): Promise<ActionResult<DataRequestRecord>> {
  return instrumentServerAction(name, async () => {
    const denied = await denyUnlessAdminCapability(DATA_REQUESTS_MANAGE_ACCESS);
    if (denied) return denied;
    let payload: string | undefined;
    if (schema) {
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return actionFailure(
          parsed.error.issues[0]?.message ?? "Check the details.",
          undefined,
          400,
        );
      }
      payload = JSON.stringify(parsed.data);
    }
    const res = await authedServerFetch(`${API}${path}`, {
      method,
      ...(payload ? { headers: { "Content-Type": "application/json" }, body: payload } : {}),
    }).catch(() => null);
    if (!res) return actionFailure(dataRequestErrorMessage(undefined, undefined), undefined, 503);
    if (!res.ok) {
      const code = await errorCodeOf(res);
      return actionFailure(dataRequestErrorMessage(code, res.status), undefined, res.status, code);
    }
    const record = readDataEnvelope(
      await readJsonBody(res),
      dataRequestRecordSchema,
      `${method} ${API}${path}`,
    );
    revalidatePath(DATA_REQUESTS_PATH);
    if (reference) revalidatePath(`${DATA_REQUESTS_PATH}/${encodeURIComponent(reference)}`);
    return actionSuccess(record);
  });
}

const ref = (reference: string) => encodeURIComponent(reference);

export async function logDataRequestAction(input: unknown) {
  return send("logDataRequestAction", "POST", "", input, createDataRequestBodySchema, null);
}

export async function patchDataRequestAction(reference: string, input: unknown) {
  return send(
    "patchDataRequestAction",
    "PATCH",
    `/${ref(reference)}`,
    input,
    patchDataRequestBodySchema,
    reference,
  );
}

export async function extendDataRequestAction(reference: string, input: unknown) {
  return send(
    "extendDataRequestAction",
    "POST",
    `/${ref(reference)}/extend`,
    input,
    extendDataRequestBodySchema,
    reference,
  );
}

export async function closeDataRequestAction(reference: string, input: unknown) {
  return send(
    "closeDataRequestAction",
    "POST",
    `/${ref(reference)}/close`,
    input,
    closeDataRequestBodySchema,
    reference,
  );
}

export async function continueDataRequestAction(reference: string) {
  return send(
    "continueDataRequestAction",
    "POST",
    `/${ref(reference)}/continue`,
    null,
    null,
    reference,
  );
}

/** Finds a LAX account by its full email address; null when there is none. */
export async function findDataRequestAccountAction(
  email: string,
): Promise<ActionResult<FoundAccountResult | null>> {
  return instrumentServerAction("findDataRequestAccountAction", async () => {
    const denied = await denyUnlessAdminCapability(DATA_REQUESTS_MANAGE_ACCESS);
    if (denied) return denied;
    const address = email.trim();
    if (!address.includes("@")) {
      return actionFailure("Enter the person's full email address.", undefined, 400);
    }
    const res = await authedServerFetch(
      `${API}/account?${new URLSearchParams({ email: address })}`,
    ).catch(() => null);
    if (!res || !res.ok) {
      return actionFailure(
        "The account search didn't answer. Try again in a moment.",
        undefined,
        res?.status ?? 503,
      );
    }
    return actionSuccess(
      readDataEnvelope(await readJsonBody(res), foundAccountSchema, `GET ${API}/account`),
    );
  });
}

/**
 * Erases every enquiry from the request's email address. The API checks the typed confirmation
 * and the reason, anonymises the enquiries, holds those tied to a deal and writes the audit
 * event with the counts and the reason in the same transaction.
 */
export async function eraseDataRequestEnquiriesAction(
  reference: string,
  input: { email: string; confirmation: string; reason: string },
): Promise<ActionResult<EnquiryErasureCounts>> {
  return instrumentServerAction("eraseDataRequestEnquiriesAction", async () => {
    const denied = await denyUnlessAdminCapability(DATA_REQUESTS_MANAGE_ACCESS);
    if (denied) return denied;
    const errors = validateErasure(input, input.email);
    const invalid = errors.confirmation ?? errors.reason;
    if (invalid) return actionFailure(invalid, undefined, 400);
    const res = await authedServerFetch(`${API}/enquiry-erasure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email.trim(),
        confirmation: input.confirmation.trim(),
        reason: input.reason.trim(),
      }),
    }).catch(() => null);
    if (!res) return actionFailure(erasureErrorMessage(undefined, undefined), undefined, 503);
    if (!res.ok) {
      const code = await errorCodeOf(res);
      return actionFailure(erasureErrorMessage(code, res.status), undefined, res.status, code);
    }
    const counts = readDataEnvelope(
      await readJsonBody(res),
      enquiryErasureCountsSchema,
      `POST ${API}/enquiry-erasure`,
    );
    revalidatePath(`${DATA_REQUESTS_PATH}/${encodeURIComponent(reference)}`);
    return actionSuccess(counts);
  });
}

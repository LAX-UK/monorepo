import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { parseIdentityReminderState } from "@/lib/seller/consignment-after-sale-parse";
import { parseConsignmentAgreement } from "@/lib/seller/consignment-agreement-parse";
import type {
  ConsignmentAgreement,
  ConsignmentAgreementView,
  StaffConsignmentView,
} from "@auction/types";

async function readData(res: Response): Promise<unknown> {
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
  return body?.data ?? null;
}

/**
 * The agreement for one consignment in the account being used, with whether the person may
 * accept it. `null` when it cannot be read.
 */
export async function getServerConsignmentAgreement(
  submissionId: string,
): Promise<ConsignmentAgreementView | null> {
  const res = await authedServerFetch(`/submissions/${encodeURIComponent(submissionId)}/agreement`);
  const data = (await readData(res)) as { agreement?: unknown; canAccept?: unknown } | null;
  if (!data) return null;
  return {
    agreement: parseConsignmentAgreement(data.agreement),
    canAccept: data.canAccept === true,
  };
}

/** Every agreement of the account being used, for the Selling overview. */
export async function listServerConsignmentAgreements(): Promise<ConsignmentAgreement[]> {
  const res = await authedServerFetch("/submissions/mine/agreements");
  const data = await readData(res);
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => parseConsignmentAgreement(row))
    .filter((row): row is ConsignmentAgreement => row !== null);
}

/** Staff: the agreement on a submission and whether its seller's identity is verified. */
export async function getAdminConsignmentView(
  submissionId: string,
): Promise<StaffConsignmentView | null> {
  const res = await authedServerFetch(
    `/submissions/${encodeURIComponent(submissionId)}/agreement/staff`,
    { skipActingLegalEntityHeader: true },
  );
  const data = (await readData(res)) as {
    agreement?: unknown;
    sellerIdentityVerified?: unknown;
    identityReminder?: unknown;
  } | null;
  if (!data) return null;
  const identityReminder = parseIdentityReminderState(data.identityReminder);
  return {
    agreement: parseConsignmentAgreement(data.agreement),
    sellerIdentityVerified: data.sellerIdentityVerified === true,
    ...(identityReminder ? { identityReminder } : {}),
  };
}

/** Staff list: the agreements of the submissions on a page. */
export async function listAdminConsignmentAgreements(
  submissionIds: readonly string[],
): Promise<ConsignmentAgreement[]> {
  if (submissionIds.length === 0) return [];
  const res = await authedServerFetch(
    `/submissions/agreements/staff?ids=${encodeURIComponent(submissionIds.join(","))}`,
    { skipActingLegalEntityHeader: true },
  );
  const data = await readData(res);
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => parseConsignmentAgreement(row))
    .filter((row): row is ConsignmentAgreement => row !== null);
}

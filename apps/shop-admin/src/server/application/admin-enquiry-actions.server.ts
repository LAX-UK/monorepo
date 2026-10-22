"use server";

import {
  ENQUIRY_KINDS,
  ENQUIRY_NOTE_MAX_LENGTH,
  ENQUIRY_STATUSES,
  type EnquiryKind,
  type EnquiryStatus,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid enquiry request.",
} as const satisfies AdminMutationResult<never>;

function enquiryPath(kind: EnquiryKind, id: string): string | null {
  return ENQUIRY_KINDS.includes(kind) && UUID_PATTERN.test(id) ? `enquiries/${kind}/${id}` : null;
}

export async function updateEnquiry(input: {
  kind: EnquiryKind;
  id: string;
  /** The version the page was rendered with; the API refuses the change if it has moved on. */
  expectedVersion: string;
  status?: EnquiryStatus;
  /** A staff identity subject, or null to unassign. */
  assigneeSubject?: string | null;
}): Promise<AdminMutationResult<{ version: string }>> {
  const path = enquiryPath(input.kind, input.id);
  if (!path || (input.status !== undefined && !ENQUIRY_STATUSES.includes(input.status))) {
    return invalidInput;
  }
  return forwardAdminJsonMutation<{ version: string }>({
    bffPath: path,
    method: "PATCH",
    jsonBody: {
      expectedVersion: input.expectedVersion,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assigneeSubject !== undefined ? { assigneeSubject: input.assigneeSubject } : {}),
    },
  });
}

export async function addEnquiryNote(input: {
  kind: EnquiryKind;
  id: string;
  body: string;
}): Promise<AdminMutationResult<unknown>> {
  const path = enquiryPath(input.kind, input.id);
  const body = input.body.trim();
  if (!path || body.length === 0 || body.length > ENQUIRY_NOTE_MAX_LENGTH) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `${path}/notes`,
    method: "POST",
    jsonBody: { body },
  });
}

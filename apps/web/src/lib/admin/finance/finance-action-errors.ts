import { normalizeApiErrorMessage } from "@auction/validators";

export function manualReviewReleaseBlockedMessage(code: string | undefined): string | null {
  switch (code) {
    case "payment_release_blocked_aml_hold":
      return "Cannot release: buyer is on an AML/sanctions hold. Clear the screening in Compliance → AML screening first.";
    case "payment_release_blocked_source_of_funds":
      return "Cannot release: Source of Funds review is required. Approve the case in Compliance → Source of Funds first.";
    default:
      return null;
  }
}

export async function normalizeFinanceApiError(
  res: Response,
  fallback: string,
): Promise<string | null> {
  if (res.ok) return null;
  let message = fallback;
  try {
    const body = (await res.json()) as { error?: unknown; code?: string };
    if (body && typeof body.error === "object" && body.error !== null) {
      const errObj = body.error as { code?: string; message?: string };
      const blocked = manualReviewReleaseBlockedMessage(errObj.code);
      if (blocked) return blocked;
      message = errObj.message ?? normalizeApiErrorMessage(body.error, message);
    } else {
      const blocked = manualReviewReleaseBlockedMessage(
        typeof body.error === "string" ? body.error : body.code,
      );
      if (blocked) return blocked;
      message = normalizeApiErrorMessage(body.error, message);
    }
  } catch {
    // Keep fallback when the API did not return JSON.
  }
  return `${message} (${res.status})`;
}

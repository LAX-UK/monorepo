import { apiBaseUrl } from "@/lib/auth/api-base";
import { type StepUpActionResult, classifyActionFailure } from "@/lib/auth/step-up";

export type ISessionsApi = {
  revoke(id: string): Promise<StepUpActionResult<void>>;
  revokeAllOthers(): Promise<StepUpActionResult<void>>;
};

async function voidResultFromResponse(res: Response): Promise<StepUpActionResult<void>> {
  if (res.ok) return { ok: true, value: undefined };
  const body = await res.json().catch(() => ({}));
  return { ok: false, reason: classifyActionFailure(res.status, body) };
}

export const httpSessionsApi: ISessionsApi = {
  async revoke(id: string) {
    return voidResultFromResponse(
      await fetch(`${apiBaseUrl()}/users/me/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      }),
    );
  },
  async revokeAllOthers() {
    return voidResultFromResponse(
      await fetch(`${apiBaseUrl()}/users/me/sessions/revoke-all`, {
        method: "POST",
        credentials: "include",
      }),
    );
  },
};

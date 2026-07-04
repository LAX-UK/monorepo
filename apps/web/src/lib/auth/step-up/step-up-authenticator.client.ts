import { apiBaseUrl } from "@/lib/auth/api-base";

export type StepUpAuthOutcome =
  | "ok"
  | "invalid_password"
  | "no_credential"
  | "session_required"
  | "network_error";

/** DIP: password proof for step-up without tying hooks to `fetch`. */
export interface IStepUpAuthenticator {
  verifyPassword(password: string): Promise<StepUpAuthOutcome>;
}

export function createHttpStepUpAuthenticator(): IStepUpAuthenticator {
  return {
    async verifyPassword(password: string): Promise<StepUpAuthOutcome> {
      try {
        const res = await fetch(`${apiBaseUrl()}/auth/reauth`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (res.ok) return "ok";
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        const code = body.code;
        if (code === "credential_required") return "no_credential";
        if (code === "session_required") return "session_required";
        if (res.status === 401 && code === "invalid_credentials") return "invalid_password";
        if (res.status === 401) return "invalid_password";
        return "network_error";
      } catch {
        return "network_error";
      }
    },
  };
}

/** Default singleton for client components. */
export const httpStepUpAuthenticator: IStepUpAuthenticator = createHttpStepUpAuthenticator();

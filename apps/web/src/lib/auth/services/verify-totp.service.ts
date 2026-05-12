import { authClient } from "@/lib/auth-client";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";

export async function verifyTotpService(input: {
  code: string;
  trustDevice?: boolean;
}): Promise<AuthSubmitResult> {
  const res = await authClient.twoFactor.verifyTotp({
    code: input.code,
    ...(input.trustDevice !== undefined ? { trustDevice: input.trustDevice } : {}),
  });
  if (res.error) {
    const code =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    return {
      ok: false,
      message: res.error.message ?? "Invalid code",
      ...(code ? { code } : {}),
    };
  }
  return { ok: true };
}

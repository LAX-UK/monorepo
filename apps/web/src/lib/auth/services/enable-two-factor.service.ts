import { authClient } from "@/lib/auth-client";

export type EnableTwoFactorResult =
  | { ok: true; totpURI: string; backupCodes: string[] }
  | { ok: false; message: string; code?: string };

export async function enableTwoFactorService(password: string): Promise<EnableTwoFactorResult> {
  const res = await authClient.twoFactor.enable({ password });
  if (res.error) {
    const code =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    return {
      ok: false,
      message: res.error.message ?? "Could not start two-factor setup",
      ...(code ? { code } : {}),
    };
  }
  const totpURI = res.data?.totpURI;
  const backupCodes = res.data?.backupCodes;
  if (typeof totpURI !== "string" || !Array.isArray(backupCodes)) {
    return { ok: false, message: "Unexpected response from server" };
  }
  return { ok: true, totpURI, backupCodes };
}

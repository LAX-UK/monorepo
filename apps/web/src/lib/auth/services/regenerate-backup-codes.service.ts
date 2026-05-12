import { authClient } from "@/lib/auth-client";

export type RegenerateBackupCodesResult =
  | { ok: true; backupCodes: string[] }
  | { ok: false; message: string; code?: string };

export async function regenerateBackupCodesService(
  password: string,
): Promise<RegenerateBackupCodesResult> {
  const res = await authClient.twoFactor.generateBackupCodes({ password });
  if (res.error) {
    const code =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    return {
      ok: false,
      message: res.error.message ?? "Could not generate new backup codes",
      ...(code ? { code } : {}),
    };
  }
  const backupCodes = res.data?.backupCodes;
  if (!Array.isArray(backupCodes)) {
    return { ok: false, message: "Unexpected response from server" };
  }
  return { ok: true, backupCodes };
}

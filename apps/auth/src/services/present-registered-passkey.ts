import type { AccountPasskey } from "@auction/identity-contracts";
import { presentPasskey } from "./account-sign-in-methods.service.js";

/**
 * A passkey the plugin just stored, as the person sees it: name, kind, whether it syncs, when it
 * was made. The plugin's own record carries the public key and the credential id; neither is ever
 * passed on. Null when the answer is not a passkey record.
 */
export function presentRegisteredPasskey(record: unknown): AccountPasskey | null {
  if (!record || typeof record !== "object") return null;
  const row = record as Record<string, unknown>;
  const { id, name, deviceType, backedUp, transports, createdAt } = row;
  if (typeof id !== "string" || id.length === 0) return null;
  if (deviceType !== "singleDevice" && deviceType !== "multiDevice") return null;
  const made = new Date(
    typeof createdAt === "string" || typeof createdAt === "number" ? createdAt : Date.now(),
  );
  return presentPasskey({
    id,
    name: typeof name === "string" ? name : null,
    deviceType,
    backedUp: backedUp === true,
    transports: typeof transports === "string" ? transports : null,
    createdAt: Number.isNaN(made.getTime()) ? new Date() : made,
    lastUsedAt: null,
  });
}

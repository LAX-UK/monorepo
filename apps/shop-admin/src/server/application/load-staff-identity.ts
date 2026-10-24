import { shopAdminSessionCookie } from "@/lib/session-cookie";
import { cookies } from "next/headers";
import { getShopAdminContainer } from "../container";
import { type StaffIdentity, readIdTokenIdentity } from "../domain/staff-identity.vm";

/** The signed-in person's name and email, or nulls when the session cannot be read. */
export async function loadStaffIdentity(): Promise<StaffIdentity> {
  try {
    const container = getShopAdminContainer();
    const sessionId = (await cookies()).get(shopAdminSessionCookie(container.config))?.value;
    if (!sessionId) return { name: null, email: null };
    const record = await container.sessions.get(sessionId);
    return readIdTokenIdentity(record?.idToken);
  } catch {
    return { name: null, email: null };
  }
}

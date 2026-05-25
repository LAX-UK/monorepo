import { cookies } from "next/headers";

export const PENDING_ENTITY_INVITE_COOKIE = "pending_entity_invite";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export async function setPendingEntityInviteCookie(token: string): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(PENDING_ENTITY_INVITE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE_SEC,
    });
  } catch {
    /* cookie mutation unavailable (read-only cookie store in Server Component render) */
  }
}

export async function getPendingEntityInviteCookie(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(PENDING_ENTITY_INVITE_COOKIE)?.value;
  return v && v.length >= 10 ? v : null;
}

export async function clearPendingEntityInviteCookie(): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(PENDING_ENTITY_INVITE_COOKIE);
  } catch {
    /* cookie mutation unavailable (read-only cookie store in Server Component render) */
  }
}

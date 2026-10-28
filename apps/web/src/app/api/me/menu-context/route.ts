import { getServerDataContainer } from "@/lib/data/container.server";
import { loadAccountMenuContext } from "@/lib/navigation/account-menu-context.server";
import { NextResponse } from "next/server";

/** Facts for the account menu, the header chip and the account sub-navigation. */
export async function GET() {
  const c = await getServerDataContainer();
  const user = await c.session.getCurrent();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json(await loadAccountMenuContext(user), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

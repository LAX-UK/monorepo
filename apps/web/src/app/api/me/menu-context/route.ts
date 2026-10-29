import { getServerDataContainer } from "@/lib/data/container.server";
import { isAccountsUnavailableError } from "@/lib/legal-entity/accounts-unavailable-error";
import { loadAccountMenuContext } from "@/lib/navigation/account-menu-context.server";
import { NextResponse } from "next/server";

const PRIVATE = { "Cache-Control": "private, no-store" };

/**
 * Facts for the account menu, the header chip and the account sub-navigation. While the
 * person's accounts cannot be read this answers 503, and the menu keeps what it showed last.
 */
export async function GET() {
  const c = await getServerDataContainer();
  const user = await c.session.getCurrent();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json(await loadAccountMenuContext(user), { headers: PRIVATE });
  } catch (error) {
    if (!isAccountsUnavailableError(error)) throw error;
    return NextResponse.json(
      { error: "accounts_unavailable" },
      { status: 503, headers: { ...PRIVATE, "Retry-After": "5" } },
    );
  }
}

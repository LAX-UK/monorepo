import { shopAdminSessionCookie } from "@/lib/session-cookie";
import { type StaffProduct, buildStaffProducts } from "@auction/staff-ui";
import { cookies } from "next/headers";
import { getShopAdminContainer } from "../container";
import type { StaffToolsAnswer } from "../ports/staff-tools-access";

const UNAVAILABLE: StaffToolsAnswer = { status: "unavailable" };

/**
 * What the Bid API says the signed-in person can open: the staff tools, and the Failed jobs
 * sources Bid shows them. "Unavailable" with no session, and whenever Bid cannot say, so callers
 * never offer a door that may be shut.
 */
export async function loadStaffToolsAnswer(): Promise<StaffToolsAnswer> {
  const container = getShopAdminContainer();
  try {
    const sessionId = (await cookies()).get(shopAdminSessionCookie(container.config))?.value;
    const record = sessionId ? await container.sessions.get(sessionId) : null;
    if (!record) return UNAVAILABLE;
    return await container.staffTools.toolsFor({
      subjectId: record.subject,
      idToken: record.idToken,
    });
  } catch {
    return UNAVAILABLE;
  }
}

/** The tools in the product switcher for an answer from `loadStaffToolsAnswer`. */
export function staffProductsFor(answer: StaffToolsAnswer): StaffProduct[] {
  const container = getShopAdminContainer();
  return buildStaffProducts({
    current: "lax-admin",
    accessible: answer.status === "ok" ? answer.tools : [],
    hrefs: {
      "lax-admin": "/",
      "bid-admin": container.config.bidPublicUrl ? `${container.config.bidPublicUrl}/admin` : null,
    },
  });
}

/**
 * The staff tools offered in LAX Admin's product switcher: LAX Admin itself, plus Bid admin when
 * the Bid API says this person can open it. Without an answer, only LAX Admin is listed (the
 * switcher then shows a plain heading), so a Bid outage never offers a door that may be shut.
 */
export async function loadStaffProducts(): Promise<StaffProduct[]> {
  return staffProductsFor(await loadStaffToolsAnswer());
}

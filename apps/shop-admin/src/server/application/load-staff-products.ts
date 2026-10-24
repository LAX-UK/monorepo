import { shopAdminSessionCookie } from "@/lib/session-cookie";
import { type StaffProduct, buildStaffProducts } from "@auction/staff-ui";
import { cookies } from "next/headers";
import { getShopAdminContainer } from "../container";

/**
 * The staff tools offered in LAX Admin's product switcher: LAX Admin itself, plus Bid admin when
 * the Bid API says this person can open it. Without an answer, only LAX Admin is listed (the
 * switcher then shows a plain heading), so a Bid outage never offers a door that may be shut.
 */
export async function loadStaffProducts(): Promise<StaffProduct[]> {
  const container = getShopAdminContainer();
  const hrefs = {
    "lax-admin": "/",
    "bid-admin": container.config.bidPublicUrl ? `${container.config.bidPublicUrl}/admin` : null,
  };
  try {
    const sessionId = (await cookies()).get(shopAdminSessionCookie(container.config))?.value;
    const record = sessionId ? await container.sessions.get(sessionId) : null;
    const answer = record
      ? await container.staffTools.toolsFor({
          subjectId: record.subject,
          idToken: record.idToken,
        })
      : null;
    return buildStaffProducts({
      current: "lax-admin",
      accessible: answer?.status === "ok" ? answer.tools : [],
      hrefs,
    });
  } catch {
    return buildStaffProducts({ current: "lax-admin", accessible: [], hrefs });
  }
}

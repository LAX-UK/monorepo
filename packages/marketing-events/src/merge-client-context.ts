import type { HashedUserData, MarketingClientContext } from "@auction/types";

export function mergeClientContextIntoUserData(
  userData: HashedUserData,
  clientContext?: MarketingClientContext,
): HashedUserData {
  if (!clientContext) return userData;
  return {
    ...userData,
    ...(clientContext.ipAddress ? { client_ip_address: clientContext.ipAddress } : {}),
    ...(clientContext.userAgent ? { client_user_agent: clientContext.userAgent } : {}),
  };
}

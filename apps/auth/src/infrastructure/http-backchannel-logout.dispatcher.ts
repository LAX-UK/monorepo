import type { BackchannelLogoutDispatcher } from "../services/backchannel-logout.ports.js";

export class HttpBackchannelLogoutDispatcher implements BackchannelLogoutDispatcher {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async dispatch(endpoint: string, logoutToken: string, timeoutMs: number) {
    const response = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ logout_token: logoutToken }),
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "manual",
    });
    return { status: response.status };
  }
}
